/**
 * Watch history: per-episode progress and the home screen's Continue Watching row.
 *
 * Two maps, both keyed by stable KVF identities:
 *   • episodes — `section:slug:sid` → position, full duration and whether it was
 *     finished. Drives resume, and the progress bars and Watched badges on
 *     episode cards.
 *   • programs — `section:slug` → the one episode to offer for that program,
 *     plus the titles and artwork needed to draw its card without a request.
 *     One card per program, as on Netflix and Disney+: finishing an episode
 *     moves the card on to the next one, finishing the last removes it.
 *
 * Reads are synchronous against memory, so React binds with
 * useSyncExternalStore. Entries are immutable — every change swaps in a new
 * object — so a card re-renders only when its own entry changes.
 *
 * Writes land in memory at once and reach storage at most every few seconds,
 * plus immediately on pause, when the player closes and when the app leaves
 * the foreground.
 */

import { AppState } from "react-native";
import { isSectionId, type SectionId } from "@/constants/sections";
import { logger } from "@/utils/logger";
import { watchProgressStorage } from "./watchProgressStorage";

/** Bump when the stored shape changes; older history is then discarded. */
const SCHEMA_VERSION = 1;

/** Nothing is recorded before this — opening an episode by mistake is not watching it. */
export const MIN_POSITION_SECONDS = 10;

/** Past this share of the runtime an episode counts as watched (the credits). */
export const COMPLETION_RATIO = 0.95;

/** A finished episode keeps its Watched badge until it has really been rewatched. */
const REWATCH_MIN_SECONDS = 30;

/** Resume slightly early so the viewer picks the thread back up. */
const RESUME_REWIND_SECONDS = 3;

/** About 110 bytes each, keeping the history far below tvOS's 500 KB NSUserDefaults cap. */
const MAX_EPISODES = 600;
const MAX_PROGRAMS = 40;

/** Cards shown in the row. */
export const CONTINUE_WATCHING_LIMIT = 20;

/** A program untouched for this long leaves the row. */
const PROGRAM_STALE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * While one episode keeps playing, its card is re-sorted at most this often.
 * Its order cannot change, and every re-sort re-renders the row.
 */
const PROGRAM_TOUCH_INTERVAL_MS = 60 * 1000;

/** Continuous playback reaches storage at most this often. */
const PERSIST_DELAY_MS = 10 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EpisodeProgress {
  /** Seconds. */
  position: number;
  /** Full runtime in seconds; 0 when the player never reported one. */
  duration: number;
  completed: boolean;
  updatedAt: number;
}

/** Identifies an episode and carries what its card needs to draw offline. */
export interface WatchTarget {
  section: SectionId;
  /** The program's slug. */
  slug: string;
  sid: string;
  programTitle: string;
  episodeTitle: string;
  thumbnailUrl: string | null;
}

export interface ContinueWatchingEntry extends WatchTarget {
  updatedAt: number;
}

interface HistoryFile {
  v: number;
  episodes: Record<string, EpisodeProgress>;
  programs: Record<string, ContinueWatchingEntry>;
}

// ── Keys ───────────────────────────────────────────────────────────────────────

export function episodeKey(section: SectionId, slug: string, sid: string): string {
  return `${section}:${slug}:${sid}`;
}

export function programKey(section: SectionId, slug: string): string {
  return `${section}:${slug}`;
}

// ── Module state ───────────────────────────────────────────────────────────────

let episodes: Record<string, EpisodeProgress> = {};
let programs: Record<string, ContinueWatchingEntry> = {};
let hydrated = false;
let hydration: Promise<void> | null = null;
/** Memoized row, so the snapshot keeps its identity until a program changes. */
let rowSnapshot: ContinueWatchingEntry[] | null = null;
const listeners = new Set<() => void>();
let dirty = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let writes: Promise<void> = Promise.resolve();
let appStateSub: { remove: () => void } | null = null;

// ── Validation ─────────────────────────────────────────────────────────────────

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidTarget(target: WatchTarget | null | undefined): target is WatchTarget {
  return !!target && isSectionId(target.section) && typeof target.slug === "string" && typeof target.sid === "string" && target.sid.length > 0;
}

function isEpisodeProgress(value: unknown): value is EpisodeProgress {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return isFiniteNumber(entry.position) && isFiniteNumber(entry.duration) && isFiniteNumber(entry.updatedAt) && typeof entry.completed === "boolean";
}

function isContinueWatchingEntry(value: unknown): value is ContinueWatchingEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    isValidTarget(entry as unknown as WatchTarget) &&
    typeof entry.programTitle === "string" &&
    typeof entry.episodeTitle === "string" &&
    (entry.thumbnailUrl === null || typeof entry.thumbnailUrl === "string") &&
    isFiniteNumber(entry.updatedAt)
  );
}

/** Copies only the known fields, so callers' extra properties never reach storage. */
function toEntry(target: WatchTarget, updatedAt: number): ContinueWatchingEntry {
  const { section, slug, sid, programTitle, episodeTitle, thumbnailUrl } = target;
  return { section, slug, sid, programTitle, episodeTitle, thumbnailUrl, updatedAt };
}

/** Runtime to store: the player's when it has one, else whatever was known before. */
function runtimeOf(duration: number, previous: EpisodeProgress | undefined): number {
  return isFiniteNumber(duration) && duration > 0 ? Math.round(duration) : (previous?.duration ?? 0);
}

// ── Hydration ──────────────────────────────────────────────────────────────────

/**
 * Parse stored history, dropping malformed entries one by one rather than
 * discarding everything for one bad record.
 */
function parseHistory(raw: string | null): HistoryFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HistoryFile> | null;
    if (!parsed || parsed.v !== SCHEMA_VERSION) {
      logger.info("Watch progress: discarding history from another version", { service: "WatchProgress", version: parsed?.v });
      return null;
    }

    const result: HistoryFile = { v: SCHEMA_VERSION, episodes: {}, programs: {} };
    for (const [key, value] of Object.entries(parsed.episodes ?? {})) {
      if (isEpisodeProgress(value)) result.episodes[key] = value;
    }
    for (const value of Object.values(parsed.programs ?? {})) {
      if (isContinueWatchingEntry(value)) result.programs[programKey(value.section, value.slug)] = value;
    }
    return result;
  } catch (error) {
    logger.warn("Watch progress: stored history unreadable, starting fresh", error, { service: "WatchProgress" });
    return null;
  }
}

/** Merge loaded history under anything recorded since launch, which is always newer. */
function adopt(loaded: HistoryFile | null): void {
  if (loaded) {
    episodes = { ...loaded.episodes, ...episodes };
    programs = { ...loaded.programs, ...programs };
  }

  const cutoff = Date.now() - PROGRAM_STALE_MS;
  for (const [key, entry] of Object.entries(programs)) {
    if (entry.updatedAt < cutoff) delete programs[key];
  }
  enforceLimits();
  rowSnapshot = null;
}

/**
 * Load stored history once. Synchronous on Apple platforms; elsewhere it
 * resolves later and notifies subscribers when it lands.
 */
function hydrate(): void {
  if (hydrated || hydration) return;

  let loaded: string | null | Promise<string | null>;
  try {
    loaded = watchProgressStorage.load();
  } catch (error) {
    logger.warn("Watch progress: failed to read history", error, { service: "WatchProgress" });
    hydrated = true;
    return;
  }

  if (typeof loaded === "string" || loaded === null) {
    adopt(parseHistory(loaded));
    hydrated = true;
    return;
  }

  hydration = loaded
    .then(
      (raw) => adopt(parseHistory(raw)),
      (error) => logger.warn("Watch progress: failed to read history", error, { service: "WatchProgress" }),
    )
    .finally(() => {
      hydrated = true;
      hydration = null;
      emit();
    });
}

// ── Limits ─────────────────────────────────────────────────────────────────────

/** Evict least recently updated entries over budget. Returns whether the row changed. */
function enforceLimits(): boolean {
  let programsChanged = false;

  const programKeys = Object.keys(programs);
  if (programKeys.length > MAX_PROGRAMS) {
    programKeys.sort((a, b) => programs[a].updatedAt - programs[b].updatedAt);
    for (const key of programKeys.slice(0, programKeys.length - MAX_PROGRAMS)) delete programs[key];
    programsChanged = true;
  }

  const episodeKeys = Object.keys(episodes);
  if (episodeKeys.length > MAX_EPISODES) {
    // An episode a card still points at keeps its progress.
    const onRow = new Set(Object.values(programs).map((entry) => episodeKey(entry.section, entry.slug, entry.sid)));
    const evictable = episodeKeys.filter((key) => !onRow.has(key)).sort((a, b) => episodes[a].updatedAt - episodes[b].updatedAt);
    for (const key of evictable.slice(0, episodeKeys.length - MAX_EPISODES)) delete episodes[key];
  }

  return programsChanged;
}

// ── Change propagation ─────────────────────────────────────────────────────────

function emit(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      logger.warn("Watch progress: subscriber threw", error, { service: "WatchProgress" });
    }
  }
}

function changed(programsChanged: boolean): void {
  if (enforceLimits() || programsChanged) rowSnapshot = null;
  schedulePersist();
  emit();
}

/** Observe any change. Returns the unsubscribe function. */
export function subscribeWatchProgress(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Persistence ────────────────────────────────────────────────────────────────

function schedulePersist(): void {
  dirty = true;
  // A throttle, not a debounce: continuous playback must still be written.
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushWatchProgress();
  }, PERSIST_DELAY_MS);
}

/** Write pending changes now. Never rejects; a failed write is retried with the next one. */
export function flushWatchProgress(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  const run = writes.then(async () => {
    // Never overwrite stored history that has not been read yet.
    if (hydration) await hydration;
    if (!dirty) return;
    dirty = false;
    const file: HistoryFile = { v: SCHEMA_VERSION, episodes, programs };
    try {
      await watchProgressStorage.save(JSON.stringify(file));
    } catch (error) {
      dirty = true;
      logger.warn("Watch progress: failed to persist history", error, { service: "WatchProgress" });
    }
  });
  writes = run.catch(() => undefined);
  return run;
}

/**
 * Load history at launch and flush whenever the app leaves the foreground —
 * the last reliable moment to write before tvOS suspends it. Idempotent.
 */
export function startWatchProgressSync(): () => void {
  hydrate();
  if (!appStateSub) {
    appStateSub = AppState.addEventListener("change", (next) => {
      if (next !== "active") void flushWatchProgress();
    });
  }
  return stopWatchProgressSync;
}

export function stopWatchProgressSync(): void {
  appStateSub?.remove();
  appStateSub = null;
  void flushWatchProgress();
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export function getEpisodeProgress(section: SectionId, slug: string, sid: string): EpisodeProgress | undefined {
  hydrate();
  return episodes[episodeKey(section, slug, sid)];
}

/** The episode a program's Continue Watching card points at, if it has one. */
export function getContinueWatchingEntry(section: SectionId, slug: string): ContinueWatchingEntry | undefined {
  hydrate();
  return programs[programKey(section, slug)];
}

/** The Continue Watching row, most recently watched first. Identity-stable between changes. */
export function getContinueWatching(): ContinueWatchingEntry[] {
  hydrate();
  if (!rowSnapshot) {
    const cutoff = Date.now() - PROGRAM_STALE_MS;
    rowSnapshot = Object.values(programs)
      .filter((entry) => entry.updatedAt >= cutoff)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, CONTINUE_WATCHING_LIMIT);
  }
  return rowSnapshot;
}

/** Whether an episode has been started but not finished. */
export function isInProgress(progress: EpisodeProgress | undefined): progress is EpisodeProgress {
  return !!progress && !progress.completed && progress.position >= MIN_POSITION_SECONDS;
}

/** Where playback should start, in seconds, or null to start from the beginning. */
export function getResumePosition(section: SectionId, slug: string, sid: string): number | null {
  const progress = getEpisodeProgress(section, slug, sid);
  return isInProgress(progress) ? Math.max(0, progress.position - RESUME_REWIND_SECONDS) : null;
}

// ── Writes ─────────────────────────────────────────────────────────────────────

/** Point the program's card at `target`. Returns whether the row changed. */
function upsertProgram(target: WatchTarget, now: number): boolean {
  const key = programKey(target.section, target.slug);
  const current = programs[key];
  const sameEpisode = current?.sid === target.sid;
  const entry = toEntry(
    {
      ...target,
      // Keep what was known when a later call has less (e.g. no artwork).
      programTitle: target.programTitle || current?.programTitle || "",
      thumbnailUrl: target.thumbnailUrl ?? (current && sameEpisode ? current.thumbnailUrl : null),
    },
    now,
  );

  if (
    current &&
    sameEpisode &&
    current.episodeTitle === entry.episodeTitle &&
    current.programTitle === entry.programTitle &&
    current.thumbnailUrl === entry.thumbnailUrl &&
    now - current.updatedAt < PROGRAM_TOUCH_INTERVAL_MS
  ) {
    return false;
  }

  programs[key] = entry;
  return true;
}

/**
 * Record the playback position of an episode, with its full runtime.
 *
 * Positions before MIN_POSITION_SECONDS are ignored, so a stray early sample
 * never overwrites real progress. Past COMPLETION_RATIO the episode is marked
 * watched instead, and `next` — the episode Up Next would play — takes its
 * place on the row.
 */
export function recordProgress(target: WatchTarget, position: number, duration: number, next: WatchTarget | null = null): void {
  if (!isValidTarget(target) || !isFiniteNumber(position) || position < MIN_POSITION_SECONDS) return;
  hydrate();

  const key = episodeKey(target.section, target.slug, target.sid);
  const previous = episodes[key];
  const runtime = runtimeOf(duration, previous);
  const at = Math.round(runtime > 0 ? Math.min(position, runtime) : position);

  if (runtime > 0 && at / runtime >= COMPLETION_RATIO) {
    markCompleted(target, runtime, next);
    return;
  }

  if (previous?.completed && at < REWATCH_MIN_SECONDS) return;

  const now = Date.now();
  const episodeChanged = !previous || previous.completed || previous.position !== at || previous.duration !== runtime;
  if (episodeChanged) episodes[key] = { position: at, duration: runtime, completed: false, updatedAt: now };

  const programsChanged = upsertProgram(target, now);
  if (episodeChanged || programsChanged) changed(programsChanged);
}

/**
 * Mark an episode watched. Its card moves on to `next` when there is one, and
 * leaves the row when this was the last episode.
 */
export function markCompleted(target: WatchTarget, duration: number, next: WatchTarget | null = null): void {
  if (!isValidTarget(target)) return;
  hydrate();

  const key = episodeKey(target.section, target.slug, target.sid);
  const previous = episodes[key];
  const runtime = runtimeOf(duration, previous);
  const pKey = programKey(target.section, target.slug);
  const current = programs[pKey];
  const following = isValidTarget(next) && next.sid !== target.sid ? next : null;

  // Credits keep reporting progress after the threshold; only the first report counts.
  const alreadyDone = previous?.completed === true && previous.duration === runtime;
  const rowSettled = following ? current?.sid === following.sid : current === undefined;
  if (alreadyDone && rowSettled) return;

  const now = Date.now();
  episodes[key] = { position: runtime || previous?.position || 0, duration: runtime, completed: true, updatedAt: now };

  if (following) {
    // The next episode belongs to the same program card, whatever it was keyed as.
    programs[pKey] = toEntry({ ...following, section: target.section, slug: target.slug, programTitle: following.programTitle || target.programTitle }, now);
  } else {
    delete programs[pKey];
  }

  changed(true);
}

/** Take a program off the Continue Watching row, keeping its episodes' progress. */
export function removeFromContinueWatching(section: SectionId, slug: string): void {
  hydrate();
  const key = programKey(section, slug);
  if (!programs[key]) return;
  delete programs[key];
  changed(true);
}

/** Forget everything that has been watched. */
export function clearWatchHistory(): Promise<void> {
  hydrate();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  // Queued behind any write in flight, so an older save cannot land afterwards.
  const run = writes.then(async () => {
    if (hydration) await hydration;
    episodes = {};
    programs = {};
    rowSnapshot = null;
    dirty = false;
    emit();
    try {
      await watchProgressStorage.clear();
    } catch (error) {
      logger.warn("Watch progress: failed to clear stored history", error, { service: "WatchProgress" });
    }
  });
  writes = run.catch(() => undefined);
  return run;
}

/** Reset module state (tests only). */
export function _resetForTesting(): void {
  episodes = {};
  programs = {};
  hydrated = false;
  hydration = null;
  rowSnapshot = null;
  listeners.clear();
  dirty = false;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  writes = Promise.resolve();
  appStateSub?.remove();
  appStateSub = null;
}
