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
import { allProgramsResource, frontPageResource } from "./kvfApi";
import { ensure, flushIndex, hydrate, prefetch } from "./kvfCache";
import { logger } from "@/utils/logger";

/** Posters warmed at launch, per front page — roughly the first visible rows. */
const PREFETCH_IMAGE_COUNT = 18;

/** Revalidation cadence while the app sits open. Matches the front-page TTL. */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

let started = false;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastRefreshAt = 0;

/**
 * Read the manifest, then warm both front pages and the derived search index.
 * The search index costs no extra request — it is merged from the two pages.
 */
export async function warmOnLaunch(): Promise<void> {
  await hydrate();

  await Promise.all([prefetch(frontPageResource("sjon")), prefetch(frontPageResource("vit"))]);

  // Derived from the two entries just warmed above, so this adds no network.
  await prefetch(allProgramsResource());

  void warmImages();
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

    for (const section of ["sjon", "vit"] as const) {
      const entry = await ensure(frontPageResource(section));
      const page = entry.data;

      for (const hero of page.featuredPrograms) {
        if (hero.thumbnailUrl) urls.push(hero.thumbnailUrl);
      }

      for (const cat of page.categories) {
        for (const prog of cat.programs) {
          if (prog.thumbnailUrl) urls.push(prog.thumbnailUrl);
          if (urls.length >= PREFETCH_IMAGE_COUNT * 2) break;
        }
        if (urls.length >= PREFETCH_IMAGE_COUNT * 2) break;
      }
    }

    if (urls.length > 0) await Image.prefetch(urls, "memory-disk");
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
    await Promise.all([ensure(frontPageResource("sjon"), true), ensure(frontPageResource("vit"), true)]);
    await ensure(allProgramsResource(), true);
  } catch (err) {
    logger.debug("kvfPreload: refresh failed, keeping cached data", { err });
  }
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === "active") {
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

  void warmOnLaunch().then(() => {
    lastRefreshAt = Date.now();
  });

  appStateSub = AppState.addEventListener("change", onAppStateChange);

  intervalTimer = setInterval(() => {
    if (AppState.currentState === "active") void refreshAll();
  }, REFRESH_INTERVAL_MS);

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
  void flushIndex();
}
