import * as SecureStore from "expo-secure-store";
import { logger } from "@/utils/logger";

const STORAGE_KEY = "watch_progress_data";
const MIN_POSITION_SECONDS = 10;
const COMPLETION_THRESHOLD = 0.95;
const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 50;

export interface WatchProgressEntry {
  position: number; // seconds
  duration: number; // seconds
  updatedAt: number; // timestamp ms
}

type ProgressMap = Record<string, WatchProgressEntry>;

// In-memory cache — loaded lazily from SecureStore once
let cache: ProgressMap | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Lazy-load cache from SecureStore on first access.
 * Deduplicates concurrent calls via shared promise.
 */
async function ensureCacheLoaded(): Promise<void> {
  if (cache !== null) return;

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        cache = JSON.parse(raw) as ProgressMap;
        // Prune in-memory only — deferred disk write happens on next save
        pruneStaleEntries();
        logger.info("Watch progress cache loaded", {
          service: "WatchProgress",
          entries: Object.keys(cache!).length,
        });
      } else {
        cache = {};
        logger.debug("Watch progress cache initialized (empty)", {
          service: "WatchProgress",
        });
      }
    } catch (error) {
      logger.warn("Failed to load watch progress, resetting", error, {
        service: "WatchProgress",
      });
      cache = {};
    } finally {
      loadPromise = null;
    }
  })();

  await loadPromise;
}

/**
 * Remove entries older than 30 days (called on initial load).
 * Only modifies in-memory cache — disk write is deferred to next save.
 */
function pruneStaleEntries(): void {
  if (!cache) return;

  const now = Date.now();
  let pruned = 0;

  for (const videoId of Object.keys(cache)) {
    if (now - cache[videoId].updatedAt > STALE_MS) {
      delete cache[videoId];
      pruned++;
    }
  }

  if (pruned > 0) {
    logger.info("Pruned stale watch progress entries", {
      service: "WatchProgress",
      pruned,
    });
  }
}

/**
 * Evict oldest entries when cache exceeds MAX_ENTRIES.
 * Uses LRU strategy based on updatedAt timestamp.
 */
function evictIfNeeded(): void {
  if (!cache) return;

  const keys = Object.keys(cache);
  if (keys.length <= MAX_ENTRIES) return;

  // Sort by updatedAt ascending (oldest first)
  const sorted = keys.sort((a, b) => cache![a].updatedAt - cache![b].updatedAt);
  const evictCount = keys.length - MAX_ENTRIES;

  for (let i = 0; i < evictCount; i++) {
    delete cache[sorted[i]];
  }

  logger.info("Evicted LRU watch progress entries", {
    service: "WatchProgress",
    evicted: evictCount,
    remaining: Object.keys(cache).length,
  });
}

/**
 * Write the in-memory cache to SecureStore.
 * Failures are logged but not thrown — the in-memory cache remains valid.
 */
async function persistCache(): Promise<void> {
  if (!cache) return;

  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    logger.warn("Failed to persist watch progress", error, {
      service: "WatchProgress",
    });
  }
}

/**
 * Get saved progress for a video.
 * Returns null if no progress exists.
 */
export async function getProgress(videoId: string): Promise<WatchProgressEntry | null> {
  await ensureCacheLoaded();
  const entry = cache![videoId] ?? null;

  if (entry) {
    logger.debug("Watch progress found", {
      service: "WatchProgress",
      videoId: videoId.substring(0, 8),
      position: Math.round(entry.position),
      duration: Math.round(entry.duration),
    });
  } else {
    logger.debug("No watch progress for video", {
      service: "WatchProgress",
      videoId: videoId.substring(0, 8),
    });
  }

  return entry;
}

/**
 * Save playback progress for a video.
 * - Skips if position < 10s (too early to be useful)
 * - Clears entry if position/duration >= 95% (video is finished)
 * - Evicts oldest entries if cache exceeds MAX_ENTRIES
 */
export async function saveProgress(videoId: string, position: number, duration: number): Promise<void> {
  await ensureCacheLoaded();

  // Skip if position is too early
  if (position < MIN_POSITION_SECONDS) {
    logger.debug("Watch progress save skipped (position too early)", {
      service: "WatchProgress",
      videoId: videoId.substring(0, 8),
      position: Math.round(position),
    });
    return;
  }

  // Clear if video is essentially finished
  if (duration > 0 && position / duration >= COMPLETION_THRESHOLD) {
    delete cache![videoId];
    logger.info("Watch progress cleared (video completed)", {
      service: "WatchProgress",
      videoId: videoId.substring(0, 8),
      percent: Math.round((position / duration) * 100),
    });
    await persistCache();
    return;
  }

  cache![videoId] = {
    position,
    duration,
    updatedAt: Date.now(),
  };

  evictIfNeeded();

  logger.debug("Watch progress saved", {
    service: "WatchProgress",
    videoId: videoId.substring(0, 8),
    position: Math.round(position),
    duration: Math.round(duration),
  });

  await persistCache();
}

/**
 * Get all in-progress entries, most recently watched first.
 * Drops near-finished items (>= 95% watched) that may have lingered after a
 * force-quit. Used to populate the Continue Watching screen.
 */
export async function getRecentProgress(limit = 30): Promise<Array<{ videoId: string } & WatchProgressEntry>> {
  await ensureCacheLoaded();

  return Object.entries(cache!)
    .map(([videoId, entry]) => ({ videoId, ...entry }))
    .filter((entry) => !(entry.duration > 0 && entry.position / entry.duration >= COMPLETION_THRESHOLD))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/**
 * Clear progress for a single video.
 */
export async function clearProgress(videoId: string): Promise<void> {
  await ensureCacheLoaded();
  delete cache![videoId];

  logger.info("Watch progress cleared for video", {
    service: "WatchProgress",
    videoId: videoId.substring(0, 8),
  });

  await persistCache();
}

/**
 * Clear all watch progress (e.g. on sign-out).
 */
export async function clearAllProgress(): Promise<void> {
  cache = {};

  logger.info("All watch progress cleared", {
    service: "WatchProgress",
  });

  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (error) {
    logger.warn("Failed to delete watch progress storage", error, {
      service: "WatchProgress",
    });
  }
}

/**
 * Reset internal state (for testing only).
 */
export function _resetForTesting(): void {
  cache = null;
  loadPromise = null;
}
