/**
 * KVF two-tier cache: memory (instant, session-only) + file system (persistent across launches).
 *
 * Strategy: stale-while-revalidate (SWR)
 *   1. Return cached data immediately (from memory or disk).
 *   2. If the cached data is stale, kick off a background refresh.
 *   3. Only show a loading state when there is no cached data at all.
 */

import * as FileSystem from "expo-file-system";
import { logger } from "@/utils/logger";

const CACHE_DIR = `${FileSystem.cacheDirectory}kvf-cache/`;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number; // unix ms
  ttl: number; // ms
}

// ── In-memory layer ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memStore = new Map<string, CacheEntry<any>>();

function memGet<T>(key: string): CacheEntry<T> | null {
  return (memStore.get(key) as CacheEntry<T>) ?? null;
}

function memSet<T>(key: string, entry: CacheEntry<T>): void {
  memStore.set(key, entry);
}

// ── File-system layer ──────────────────────────────────────────────────────────
async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function filePath(key: string): string {
  // Sanitise key for use as a filename.
  return `${CACHE_DIR}${key.replace(/[^a-zA-Z0-9_\-]/g, "_")}.json`;
}

async function diskGet<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const path = filePath(key);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function diskSet<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(filePath(key), JSON.stringify(entry));
  } catch (err) {
    logger.warn("kvfCache: disk write failed", { key, err });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() > entry.fetchedAt + entry.ttl;
}

/**
 * Read from cache (memory first, then disk).
 * Returns `null` when nothing is cached.
 */
export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const mem = memGet<T>(key);
  if (mem) return mem;

  const disk = await diskGet<T>(key);
  if (disk) {
    // Warm memory so subsequent reads skip disk.
    memSet(key, disk);
    return disk;
  }

  return null;
}

/**
 * Write to both memory and disk.
 */
export async function cacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ttl: ttlMs };
  memSet(key, entry);
  await diskSet(key, entry);
}

/**
 * Fetch with SWR.
 *
 * - If cached data exists (even stale) it is returned immediately via `onData`.
 * - A background fetch is triggered when the entry is stale or absent.
 * - `onData` may be called twice: once with stale data, once with the fresh result.
 * - `onLoading(true)` is called only when there is NO cached data (first-ever load).
 */
export async function fetchSWR<T>(opts: {
  key: string;
  ttlMs: number;
  fetcher: () => Promise<T>;
  onData: (data: T) => void;
  onLoading?: (loading: boolean) => void;
  onError?: (err: unknown) => void;
}): Promise<void> {
  const { key, ttlMs, fetcher, onData, onLoading, onError } = opts;

  const cached = await cacheGet<T>(key);

  if (cached) {
    // Serve stale-or-fresh data immediately.
    onData(cached.data);

    // Only revalidate if stale.
    if (!isStale(cached)) return;
  } else {
    // Nothing cached — show loading.
    onLoading?.(true);
  }

  // Background (or initial) fetch.
  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh, ttlMs);
    onData(fresh);
  } catch (err) {
    logger.warn("kvfCache: fetch failed", { key, err });
    onError?.(err);
  } finally {
    onLoading?.(false);
  }
}

// TTL constants (export for reuse in kvfApi).
export const TTL = {
  FRONT_PAGE: 15 * 60 * 1000, // 15 min
  PROGRAM: 60 * 60 * 1000, // 1 hr
  EPISODE: 6 * 60 * 60 * 1000, // 6 hr (stream URLs rarely change)
} as const;
