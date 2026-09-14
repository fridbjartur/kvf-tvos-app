/**
 * KVF persistent cache — stale-while-revalidate over a two-tier store.
 *
 *   memory (instant)  →  disk (survives launches)  →  network (last resort)
 *
 * Design notes:
 *   • Metadata lives in a single `index.json` manifest, hydrated once at boot.
 *     Staleness checks therefore never touch the filesystem, and a revalidation
 *     that finds *unchanged* content rewrites only that small manifest.
 *   • Every payload carries a content hash. When a refetch produces the same
 *     hash, subscribers are NOT notified — object identity is preserved, so no
 *     FlatList re-renders and tvOS focus is never disturbed. This is the common
 *     case: KVF data only changes when new shows are published.
 *   • Entries are namespaced by API base URL, so pointing the app at a different
 *     server can never serve that server's data from another server's cache.
 *   • CACHE_VERSION invalidates everything at once after a payload shape change.
 */

import * as FileSystem from "expo-file-system/legacy";
import { logger } from "@/utils/logger";

/** Bump whenever the cached payload shape changes (e.g. edits to types/kvf.ts). */
export const CACHE_VERSION = 3;

const CACHE_DIR = `${FileSystem.cacheDirectory}kvf-cache/`;
const INDEX_PATH = `${CACHE_DIR}index.json`;
const TMP_SUFFIX = ".tmp";

/** Disk budget. tvOS may purge the cache directory at any time, so stay modest. */
const MAX_ENTRIES = 240;
// Pinned entries are exempt from LRU but still count against the budget, and
// there are now five pinned front pages instead of two.
const MAX_BYTES = 12 * 1024 * 1024;

/** Payloads held in RAM. Front pages are pinned and never counted out. */
const MAX_MEM_ENTRIES = 60;

/** Manifest writes are batched — a burst of writes costs one flush. */
const INDEX_FLUSH_DELAY_MS = 400;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Change-detection metadata for a cached payload. */
export interface CacheMeta {
  /** Content hash of the raw response body. */
  hash: string;
  etag?: string;
  lastModified?: string;
}

/** A cached payload plus everything known about it. */
export interface CacheEntry<T> extends CacheMeta {
  key: string;
  data: T;
  fetchedAt: number;
  ttl: number;
}

/** Per-key manifest record. The manifest — not the data file — owns freshness. */
interface IndexRecord extends CacheMeta {
  ns: string;
  fetchedAt: number;
  ttl: number;
  bytes: number;
  lastAccess: number;
  pinned: boolean;
}

interface IndexFile {
  v: number;
  records: Record<string, IndexRecord>;
}

/** What a resource's fetcher reports back after hitting the network. */
export type FetchOutcome<T> = { status: "unchanged"; meta?: Partial<CacheMeta> } | { status: "ok"; data: T; meta: CacheMeta };

/**
 * Fetches a resource, given whatever is already cached for it.
 * Implementations should use `cached` to make a conditional request and/or to
 * short-circuit parsing when the body is byte-identical.
 */
export type ConditionalFetch<T> = (cached: CacheMeta | null) => Promise<FetchOutcome<T>>;

/** A cacheable unit of API data. */
export interface Resource<T> {
  key: string;
  ttlMs: number;
  fetcher: ConditionalFetch<T>;
  /** Pinned entries are exempt from LRU eviction (front pages, search index). */
  pinned?: boolean;
}

// ── Hashing ────────────────────────────────────────────────────────────────────

function fnv1a(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * ~64-bit content fingerprint (length + two independently seeded FNV-1a runs).
 * Used only to detect whether a resource changed between two fetches, so the
 * collision bar is low and a single pass over the string keeps it cheap.
 */
export function contentHash(raw: string): string {
  return `${raw.length.toString(36)}.${fnv1a(raw, 0x811c9dc5).toString(36)}.${fnv1a(raw, 0x9e3779b1).toString(36)}`;
}

/** Cache keys contain `:` and slugs contain arbitrary characters — hash to a safe filename. */
function fileFor(key: string): string {
  return `${CACHE_DIR}${fnv1a(key, 0x811c9dc5).toString(36)}-${fnv1a(key, 0x9e3779b1).toString(36)}.json`;
}

// ── Module state ───────────────────────────────────────────────────────────────

const memData = new Map<string, unknown>();
const subscribers = new Map<string, Set<(entry: CacheEntry<never>) => void>>();
const statusSubscribers = new Map<string, Set<(revalidating: boolean) => void>>();
const inflight = new Map<string, Promise<{ entry: CacheEntry<never>; changed: boolean }>>();

let index: IndexFile = { v: CACHE_VERSION, records: {} };
let namespace = "default";
let hydration: Promise<void> | null = null;
let indexDirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Scope every entry to an API base URL. Entries recorded under a different
 * namespace are invisible (and swept on the next eviction pass).
 */
export function setNamespace(baseUrl: string): void {
  namespace = fnv1a(baseUrl, 0x811c9dc5).toString(36);
}

// ── Disk ───────────────────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

async function wipeDir(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {
    // Nothing to delete, or the OS already purged it.
  }
}

/**
 * Load the manifest into memory. Safe to call from anywhere — the first caller
 * does the work and everyone else awaits the same promise.
 */
export function hydrate(): Promise<void> {
  if (hydration) return hydration;

  hydration = (async () => {
    try {
      await ensureDir();
      const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
      const parsed = JSON.parse(raw) as IndexFile;

      if (parsed.v !== CACHE_VERSION) {
        logger.info("kvfCache: version changed, discarding cache", { from: parsed.v, to: CACHE_VERSION });
        await wipeDir();
        await ensureDir();
        index = { v: CACHE_VERSION, records: {} };
        return;
      }

      index = { v: CACHE_VERSION, records: parsed.records ?? {} };
    } catch {
      // No manifest yet (first launch) or it was purged/corrupt — start clean.
      index = { v: CACHE_VERSION, records: {} };
    }
  })();

  return hydration;
}

function scheduleFlush(): void {
  indexDirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushIndex();
  }, INDEX_FLUSH_DELAY_MS);
}

/** Persist the manifest now. Called on a debounce and when the app backgrounds. */
export async function flushIndex(): Promise<void> {
  if (!indexDirty) return;
  indexDirty = false;
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(index));
  } catch (err) {
    indexDirty = true;
    logger.warn("kvfCache: index flush failed", { err });
  }
}

/** Write payload atomically so a crash mid-write can never leave a torn file. */
async function writePayload(key: string, data: unknown): Promise<number> {
  const path = fileFor(key);
  const tmp = `${path}${TMP_SUFFIX}`;
  const body = JSON.stringify({ v: CACHE_VERSION, key, data });
  await ensureDir();
  await FileSystem.writeAsStringAsync(tmp, body);
  await FileSystem.moveAsync({ from: tmp, to: path });
  return body.length;
}

async function readPayload<T>(key: string): Promise<T | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(fileFor(key));
    const parsed = JSON.parse(raw) as { v: number; key: string; data: T };
    // Guard against a filename hash collision and against stale-format files.
    if (parsed.v !== CACHE_VERSION || parsed.key !== key) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

// ── Eviction ───────────────────────────────────────────────────────────────────

function rememberInMemory(key: string, data: unknown): void {
  memData.set(key, data);
  if (memData.size <= MAX_MEM_ENTRIES) return;

  // Drop the least recently accessed unpinned payloads. Manifest records stay,
  // so evicted entries are still served from disk rather than refetched.
  const evictable = [...memData.keys()].filter((k) => !index.records[k]?.pinned).sort((a, b) => (index.records[a]?.lastAccess ?? 0) - (index.records[b]?.lastAccess ?? 0));

  for (const k of evictable) {
    if (memData.size <= MAX_MEM_ENTRIES) break;
    memData.delete(k);
  }
}

/** Drop foreign-namespace, over-budget and over-count entries from disk. */
async function evict(): Promise<void> {
  const keys = Object.keys(index.records);

  // Entries from another API base URL are dead weight — drop them first.
  const doomed = new Set(keys.filter((k) => index.records[k].ns !== namespace));

  let count = keys.length - doomed.size;
  let bytes = 0;
  for (const k of keys) {
    if (!doomed.has(k)) bytes += index.records[k].bytes;
  }

  if (count > MAX_ENTRIES || bytes > MAX_BYTES) {
    const evictable = keys.filter((k) => !doomed.has(k) && !index.records[k].pinned).sort((a, b) => index.records[a].lastAccess - index.records[b].lastAccess);

    for (const k of evictable) {
      if (count <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
      doomed.add(k);
      count -= 1;
      bytes -= index.records[k].bytes;
    }
  }

  if (doomed.size === 0) return;

  for (const k of doomed) {
    delete index.records[k];
    memData.delete(k);
    try {
      await FileSystem.deleteAsync(fileFor(k), { idempotent: true });
    } catch {
      // Best effort — a failed unlink just wastes disk until the next sweep.
    }
  }

  scheduleFlush();
  logger.debug("kvfCache: evicted", { count: doomed.size });
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() > entry.fetchedAt + entry.ttl;
}

function assemble<T>(key: string, record: IndexRecord, data: T): CacheEntry<T> {
  return { key, data, fetchedAt: record.fetchedAt, ttl: record.ttl, hash: record.hash, etag: record.etag, lastModified: record.lastModified };
}

/**
 * Synchronous read of the memory tier.
 *
 * `cacheGet` is async, so a screen bound to an already-warm resource would still
 * paint one spinner frame before its data arrived. Peeking lets that screen
 * render populated on its very first frame. Returns `null` unless the payload is
 * in RAM *and* belongs to the current namespace — disk reads stay async.
 *
 * Deliberately free of side effects, including the LRU touch `cacheGet` does:
 * callers read this during render, and the `cacheGet` that follows on the very
 * next tick records the access anyway.
 */
export function cachePeek<T>(key: string): T | null {
  const record = index.records[key];
  if (!record || record.ns !== namespace) return null;

  const mem = memData.get(key);
  return mem === undefined ? null : (mem as T);
}

/** Read a cached entry, memory first. Returns `null` when nothing is cached. */
export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  await hydrate();

  const record = index.records[key];
  if (!record || record.ns !== namespace) return null;

  record.lastAccess = Date.now();

  const mem = memData.get(key);
  if (mem !== undefined) return assemble(key, record, mem as T);

  const data = await readPayload<T>(key);
  if (data === null) {
    // Manifest and disk disagree (OS purge, torn write) — forget the record.
    delete index.records[key];
    scheduleFlush();
    return null;
  }

  rememberInMemory(key, data);
  return assemble(key, record, data);
}

/** Write a payload to memory + disk and notify subscribers. */
export async function cacheSet<T>(key: string, data: T, ttlMs: number, meta: CacheMeta, pinned = false): Promise<CacheEntry<T>> {
  await hydrate();

  let bytes = index.records[key]?.bytes ?? 0;
  try {
    bytes = await writePayload(key, data);
  } catch (err) {
    // Disk is full or purged mid-write; memory caching still helps this session.
    logger.warn("kvfCache: payload write failed", { key, err });
  }

  const now = Date.now();
  index.records[key] = { ns: namespace, fetchedAt: now, ttl: ttlMs, bytes, lastAccess: now, pinned, ...meta };
  rememberInMemory(key, data);
  scheduleFlush();
  void evict();

  const entry = assemble(key, index.records[key], data);
  notify(key, entry);
  return entry;
}

/**
 * Record that a revalidation confirmed the cached payload is still current.
 * Only the manifest changes — the payload file is untouched and no subscriber
 * is notified, so nothing re-renders.
 */
async function touch(key: string, ttlMs: number, meta: Partial<CacheMeta>): Promise<void> {
  const record = index.records[key];
  if (!record) return;
  record.fetchedAt = Date.now();
  record.ttl = ttlMs;
  if (meta.etag !== undefined) record.etag = meta.etag;
  if (meta.lastModified !== undefined) record.lastModified = meta.lastModified;
  scheduleFlush();
}

// ── Subscriptions ──────────────────────────────────────────────────────────────

/**
 * Observe a key. The callback fires only when the payload actually changes, so
 * several screens sharing one resource stay in sync without redundant fetches.
 */
export function subscribe<T>(key: string, cb: (entry: CacheEntry<T>) => void): () => void {
  const set = subscribers.get(key) ?? new Set();
  set.add(cb as (entry: CacheEntry<never>) => void);
  subscribers.set(key, set);

  return () => {
    set.delete(cb as (entry: CacheEntry<never>) => void);
    if (set.size === 0) subscribers.delete(key);
  };
}

function notify<T>(key: string, entry: CacheEntry<T>): void {
  const set = subscribers.get(key);
  if (!set) return;
  for (const cb of [...set]) {
    try {
      cb(entry as unknown as CacheEntry<never>);
    } catch (err) {
      logger.warn("kvfCache: subscriber threw", { key, err });
    }
  }
}

/**
 * Observe whether a key is currently being revalidated.
 *
 * Every network round-trip funnels through `revalidate`, whoever started it — a
 * screen's own `swr`, or the central refresh `kvfPreload` drives. Without this,
 * a preload-driven refresh is invisible to the UI and new content simply appears
 * unannounced. The callback fires `true` when a request starts and `false` when
 * it settles, so screens can show a passive indicator over data already on view.
 */
export function subscribeStatus(key: string, cb: (revalidating: boolean) => void): () => void {
  const set = statusSubscribers.get(key) ?? new Set();
  set.add(cb);
  statusSubscribers.set(key, set);

  return () => {
    set.delete(cb);
    if (set.size === 0) statusSubscribers.delete(key);
  };
}

/** Whether a request is in flight for `key` right now. */
export function isRevalidating(key: string): boolean {
  return inflight.has(key);
}

function notifyStatus(key: string, revalidating: boolean): void {
  const set = statusSubscribers.get(key);
  if (!set) return;
  for (const cb of [...set]) {
    try {
      cb(revalidating);
    } catch (err) {
      logger.warn("kvfCache: status subscriber threw", { key, err });
    }
  }
}

// ── Revalidation ───────────────────────────────────────────────────────────────

/**
 * Hit the network for `resource`, collapsing concurrent callers onto one request.
 * Resolves with the resulting entry and whether the payload actually changed.
 */
function revalidate<T>(resource: Resource<T>, cached: CacheEntry<T> | null): Promise<{ entry: CacheEntry<T>; changed: boolean }> {
  const existing = inflight.get(resource.key);
  if (existing) return existing as unknown as Promise<{ entry: CacheEntry<T>; changed: boolean }>;

  const run = (async () => {
    const outcome = await resource.fetcher(cached ? { hash: cached.hash, etag: cached.etag, lastModified: cached.lastModified } : null);

    // Server said 304, or the body hashed identically — refresh freshness only.
    if (outcome.status === "unchanged") {
      if (cached) {
        await touch(resource.key, resource.ttlMs, outcome.meta ?? {});
        return { entry: { ...cached, fetchedAt: Date.now(), ttl: resource.ttlMs }, changed: false };
      }
      // "Unchanged" with nothing cached means the fetcher misreported.
      throw new Error(`kvfCache: unchanged response with no cached entry for ${resource.key}`);
    }

    if (cached && cached.hash === outcome.meta.hash) {
      await touch(resource.key, resource.ttlMs, outcome.meta);
      return { entry: { ...cached, fetchedAt: Date.now(), ttl: resource.ttlMs }, changed: false };
    }

    const entry = await cacheSet(resource.key, outcome.data, resource.ttlMs, outcome.meta, resource.pinned);
    return { entry, changed: true };
  })();

  inflight.set(resource.key, run as unknown as Promise<{ entry: CacheEntry<never>; changed: boolean }>);
  notifyStatus(resource.key, true);

  return run.finally(() => {
    inflight.delete(resource.key);
    notifyStatus(resource.key, false);
  });
}

// ── Public entry points ────────────────────────────────────────────────────────

export interface SwrCallbacks<T> {
  /** Fires with cached data immediately, then again only if a refetch changed it. */
  onData?: (data: T, info: { fromCache: boolean }) => void;
  /** True only while there is nothing at all to show. */
  onLoading?: (loading: boolean) => void;
  /** True while revalidating behind already-visible data. */
  onRefreshing?: (refreshing: boolean) => void;
  onError?: (err: unknown) => void;
}

/**
 * Stale-while-revalidate read.
 *
 * Emits cached data synchronously-as-possible, then revalidates in the
 * background. `onData` fires a second time only when the payload really changed.
 */
export async function swr<T>(resource: Resource<T>, cbs: SwrCallbacks<T> = {}, force = false): Promise<void> {
  let cached: CacheEntry<T> | null = null;

  try {
    cached = await cacheGet<T>(resource.key);
  } catch (err) {
    logger.warn("kvfCache: read failed", { key: resource.key, err });
  }

  if (cached) {
    cbs.onData?.(cached.data, { fromCache: true });
    if (!force && !isStale(cached)) return;
    cbs.onRefreshing?.(true);
  } else {
    cbs.onLoading?.(true);
  }

  try {
    const { entry, changed } = await revalidate(resource, cached);
    if (changed) cbs.onData?.(entry.data, { fromCache: false });
  } catch (err) {
    logger.warn("kvfCache: revalidate failed", { key: resource.key, err });
    // With data on screen this is a silent stale-if-error; the caller decides.
    cbs.onError?.(err);
  } finally {
    cbs.onLoading?.(false);
    cbs.onRefreshing?.(false);
  }
}

/**
 * Await a usable value for `resource`.
 *
 * Returns cached data when fresh, revalidates when stale, and falls back to
 * stale data if the network fails. Throws only when there is nothing to return.
 */
export async function ensure<T>(resource: Resource<T>, force = false): Promise<CacheEntry<T>> {
  const cached = await cacheGet<T>(resource.key);
  if (cached && !force && !isStale(cached)) return cached;

  try {
    const { entry } = await revalidate(resource, cached);
    return entry;
  } catch (err) {
    if (cached) {
      logger.warn("kvfCache: serving stale after failed revalidate", { key: resource.key, err });
      return cached;
    }
    throw err;
  }
}

/** Warm a resource into the cache without disturbing any UI. */
export async function prefetch<T>(resource: Resource<T>): Promise<void> {
  try {
    await ensure(resource);
  } catch (err) {
    logger.debug("kvfCache: prefetch failed", { key: resource.key, err });
  }
}

/** Drop everything. Used when the API base URL changes. */
export async function clearAll(): Promise<void> {
  memData.clear();
  inflight.clear();
  index = { v: CACHE_VERSION, records: {} };
  indexDirty = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await wipeDir();
  await ensureDir();
}

/** Test seam — resets module state without touching the filesystem. */
export function __resetForTests(): void {
  memData.clear();
  subscribers.clear();
  statusSubscribers.clear();
  inflight.clear();
  index = { v: CACHE_VERSION, records: {} };
  namespace = "default";
  hydration = null;
  indexDirty = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

// ── TTLs ───────────────────────────────────────────────────────────────────────

export const TTL = {
  /** Front pages change only when new shows are published. */
  FRONT_PAGE: 15 * 60 * 1000,
  PROGRAM: 60 * 60 * 1000,
  /** Stream URLs are stable but not permanent. */
  EPISODE: 6 * 60 * 60 * 1000,
  /** Matches the server: `isLive` and the music logs move through the day. */
  SCHEDULE: 5 * 60 * 1000,
} as const;
