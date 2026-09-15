/**
 * Launch warm-up and coordinated refresh for KVF data.
 *
 * Centralising this matters: the native tab bar keeps every tab screen mounted,
 * so if each screen drove its own foreground/interval refresh the app would fan
 * one user action out into several identical requests. Everything here runs
 * once and the cache's subscription layer pushes results to whoever is mounted.
 */

import { AppState, type AppStateStatus } from "react-native";
import { Image } from "expo-image";
import { SECTION_IDS } from "@/constants/sections";
import type { FrontPage, SchedulePage } from "@/types/kvf";
import { allProgramsResource, frontPageResource } from "./kvfApi";
import { cacheGet, ensure, flushIndex, hydrate, prefetch, type Resource } from "./kvfCache";
import { logger } from "@/utils/logger";

/** Posters warmed at launch, per front page — roughly the first visible rows. */
const PREFETCH_IMAGE_COUNT = 18;

/**
 * Sections whose posters are warmed at launch.
 *
 * All five front pages are warmed as JSON so a pill press never hits the
 * network, but only the two landing sections have their images decoded — the
 * rest arrive by the time the user has navigated to them.
 */
const IMAGE_WARM_SECTIONS = ["sjon", "ljod"] as const;

/** Revalidation cadence while the app sits open. Matches the front-page TTL. */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/** Schedules move far faster than front pages — `isLive` turns over hourly. */
const SCHEDULE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let started = false;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastRefreshAt = 0;
let activeSchedule: Resource<SchedulePage> | null = null;

/**
 * Read the manifest, then warm every front page and the derived search index.
 * The search index costs no extra request — it is merged from those pages.
 */
export async function warmOnLaunch(): Promise<void> {
  await hydrate();

  // Building the index already warms every front page. A separate pass first
  // would repeat the entire retry budget for failed sections on offline launch.
  await prefetch(allProgramsResource());

  void warmImages();
}

/**
 * Register the schedule currently on screen so it can be polled at its own
 * cadence. The screen says *what* is visible; refresh timing stays here, since
 * the native tab bar keeps every screen mounted and per-screen timers would
 * fan out.
 */
export function setActiveSchedule(resource: Resource<SchedulePage> | null): void {
  activeSchedule = resource;
}

async function refreshActiveSchedule(): Promise<void> {
  const resource = activeSchedule;
  if (!resource) return;
  try {
    await ensure(resource, true);
  } catch (err) {
    logger.debug("kvfPreload: schedule refresh failed, keeping cached data", { err });
  }
}

/**
 * Push the first screenful of posters into expo-image's disk cache.
 *
 * On tvOS the perceived cost of opening a tab is dominated by image decode, not
 * by JSON — a populated grid of empty tiles still reads as "loading".
 */
async function warmImages(): Promise<void> {
  try {
    const urls: string[] = [];

    for (const section of IMAGE_WARM_SECTIONS) {
      const entry = await cacheGet<FrontPage>(frontPageResource(section).key);
      if (!entry) continue;
      const page = entry.data;

      // Budgeted per section, heroes included — an unbounded hero loop would
      // let one page with a long carousel crowd out the other's first row.
      let taken = 0;

      for (const hero of page.featuredPrograms) {
        if (taken >= PREFETCH_IMAGE_COUNT) break;
        if (!hero.thumbnailUrl) continue;
        urls.push(hero.thumbnailUrl);
        taken += 1;
      }

      for (const cat of page.categories) {
        for (const prog of cat.programs) {
          if (taken >= PREFETCH_IMAGE_COUNT) break;
          if (!prog.thumbnailUrl) continue;
          urls.push(prog.thumbnailUrl);
          taken += 1;
        }
        if (taken >= PREFETCH_IMAGE_COUNT) break;
      }
    }

    if (urls.length > 0 && AppState.currentState === "active") await Image.prefetch([...new Set(urls)], "memory-disk");
  } catch (err) {
    logger.debug("kvfPreload: image warm-up skipped", { err });
  }
}

/**
 * Force a revalidation of everything the user can see.
 *
 * Front pages first, then the search index — so the merge reads the values that
 * were just refreshed rather than the previous ones.
 */
export async function refreshAll(): Promise<void> {
  lastRefreshAt = Date.now();
  try {
    await Promise.allSettled(SECTION_IDS.map((section) => ensure(frontPageResource(section), true)));
    await ensure(allProgramsResource(), true);
  } catch (err) {
    logger.debug("kvfPreload: refresh failed, keeping cached data", { err });
  }
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === "active") {
    // The schedule has a five-minute TTL of its own, so it is worth refetching
    // on every return regardless of when the front pages last moved.
    void refreshActiveSchedule();

    // Coming back inside the TTL means the data is still current — a refresh
    // would be a wasted round-trip on every tab-out.
    if (Date.now() - lastRefreshAt < REFRESH_INTERVAL_MS) return;
    void refreshAll();
    return;
  }

  // Leaving the foreground is the last reliable moment to persist the manifest.
  void flushIndex();
}

/** Wire up launch warm-up, foreground refresh and the idle interval. Idempotent. */
export function startKvfSync(): () => void {
  if (started) return stopKvfSync;
  started = true;

  void warmOnLaunch().then(
    () => {
      lastRefreshAt = Date.now();
    },
    (err) => logger.warn("kvfPreload: launch warm-up failed", { err }),
  );

  appStateSub = AppState.addEventListener("change", onAppStateChange);

  intervalTimer = setInterval(() => {
    if (AppState.currentState === "active") void refreshAll();
  }, REFRESH_INTERVAL_MS);

  scheduleTimer = setInterval(() => {
    if (AppState.currentState === "active") void refreshActiveSchedule();
  }, SCHEDULE_REFRESH_INTERVAL_MS);

  return stopKvfSync;
}

export function stopKvfSync(): void {
  started = false;
  appStateSub?.remove();
  appStateSub = null;
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = null;
  }
  void flushIndex();
}
