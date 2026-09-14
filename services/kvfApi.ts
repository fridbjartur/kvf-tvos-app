/**
 * KVF API client.
 *
 * Every endpoint is exposed as a `Resource` — a cache key, a TTL and a
 * conditional fetcher — which `services/kvfCache.ts` reads through and
 * `hooks/useKvfResource.ts` binds to React. Callers never touch `fetch`.
 *
 * The fetchers are deliberately lazy: a response that is byte-identical to what
 * is already cached is detected *before* `JSON.parse`, so the common "nothing
 * new published" refresh costs one request and nothing else — no parse, no
 * re-keying, no React state change.
 *
 * Base URL comes from EXPO_PUBLIC_KVF_API_BASE_URL, falls back to the home NAS,
 * and can be overridden in Settings.
 */

import * as SecureStore from "expo-secure-store";
import { SECTION_IDS, SECTIONS, sectionIdFromApiProgramUrl, type Channel, type SectionId } from "@/constants/sections";
import type { EpisodeDetail, FrontPage, IndexedProgram, ProgramPage, SchedulePage } from "@/types/kvf";
import { CacheMeta, ConditionalFetch, contentHash, ensure, FetchOutcome, Resource, setNamespace, TTL } from "./kvfCache";
import { withListKeys } from "@/utils/keys";
import { logger } from "@/utils/logger";
import { retryWithBackoff } from "@/utils/retry";

const FALLBACK_BASE_URL = "http://192.168.1.10:3939";
const STORE_KEY = "kvf_api_base_url";

/** A stalled request is worse than stale data — fail fast and keep what we have. */
const REQUEST_TIMEOUT_MS = 10000;

const RETRY = { maxAttempts: 3, initialDelayMs: 400, maxDelayMs: 2000 };

/** Statuses worth a second attempt; everything else fails immediately. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const DEFAULT_API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_KVF_API_BASE_URL || FALLBACK_BASE_URL);

let _baseUrl: string = DEFAULT_API_BASE_URL;
setNamespace(_baseUrl);

// ── Config ─────────────────────────────────────────────────────────────────────

export async function loadApiUrl(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    if (stored) _baseUrl = normalizeBaseUrl(stored);
  } catch {
    // Fall back to default
  }
  setNamespace(_baseUrl);
}

export async function saveApiUrl(url: string): Promise<void> {
  _baseUrl = normalizeBaseUrl(url || DEFAULT_API_BASE_URL);
  await SecureStore.setItemAsync(STORE_KEY, _baseUrl);
  // Namespacing (rather than clearing) keeps the previous server's cache warm
  // in case the user switches back.
  setNamespace(_baseUrl);
}

export function getApiUrl(): string {
  return _baseUrl;
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

type HttpResult = { status: 304 } | { status: 200; raw: string; etag?: string; lastModified?: string };

/**
 * GET with a hard timeout and conditional-request headers.
 *
 * Error messages are phrased to match the retryable patterns in utils/retry.ts,
 * so transient failures back off and permanent ones (404, 400) fail at once.
 */
async function httpGet(path: string, cached: CacheMeta | null): Promise<HttpResult> {
  const url = `${_baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

  try {
    logger.debug("kvfApi: fetch", { url, conditional: Boolean(cached?.etag || cached?.lastModified) });
    const res = await fetch(url, { headers, signal: controller.signal });

    if (res.status === 304) return { status: 304 };

    if (!res.ok) {
      throw new Error(RETRYABLE_STATUS.has(res.status) ? `Service unavailable (HTTP ${res.status}) for ${url}` : `HTTP ${res.status} for ${url}`);
    }

    return {
      status: 200,
      raw: await res.text(),
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
    };
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message))) {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms for ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a fetcher for a JSON endpoint.
 *
 * `transform` runs once per genuinely new payload and its result is what gets
 * cached — so `listKey`s are computed once and stay referentially stable for as
 * long as the content does.
 */
function jsonFetcher<T>(path: string, transform: (raw: never) => T): ConditionalFetch<T> {
  return async (cached) => {
    const res = await retryWithBackoff(() => httpGet(path, cached), RETRY);

    if (res.status === 304) return { status: "unchanged" };

    const hash = contentHash(res.raw);

    // Server doesn't do ETags (or ignored ours) but the body is identical —
    // stop here rather than parsing and re-keying an unchanged payload.
    if (cached && cached.hash === hash) {
      return { status: "unchanged", meta: { etag: res.etag, lastModified: res.lastModified } };
    }

    return { status: "ok", data: transform(JSON.parse(res.raw) as never), meta: { hash, etag: res.etag, lastModified: res.lastModified } };
  };
}

// ── List keys ──────────────────────────────────────────────────────────────────
// The API can return duplicate/missing slugs and sids. Every response is
// normalized so all list items carry a unique `listKey` for React.

function keyFrontPage(page: FrontPage): FrontPage {
  return {
    ...page,
    featuredPrograms: withListKeys(page.featuredPrograms, (p) => p.slug),
    categories: withListKeys(page.categories, (c) => (c.id != null ? String(c.id) : c.title)).map((cat) => ({
      ...cat,
      programs: withListKeys(cat.programs, (p) => p.slug),
    })),
  };
}

function keyProgramPage(page: ProgramPage): ProgramPage {
  return { ...page, episodes: withListKeys(page.episodes, (e) => e.sid) };
}

function keySchedulePage(page: SchedulePage): SchedulePage {
  const entries = withListKeys(page.entries, (e) => e.startTime).map((entry) => ({
    ...entry,
    music: withListKeys(entry.music, (m) => m.title),
  }));

  // Re-resolve against the keyed array so `nowPlaying` is the *same object* as
  // its row, and "is this the live entry?" stays an identity check.
  const startsAt = page.nowPlaying?.startsAt;
  const nowPlaying = startsAt ? (entries.find((e) => e.startsAt === startsAt) ?? null) : null;

  return { ...page, entries, nowPlaying };
}

// ── Resources ──────────────────────────────────────────────────────────────────

export function frontPageResource(section: SectionId): Resource<FrontPage> {
  return {
    key: `kvf:${section}:front`,
    ttlMs: TTL.FRONT_PAGE,
    pinned: true,
    fetcher: jsonFetcher<FrontPage>(`/api/${SECTIONS[section].apiPath}`, keyFrontPage),
  };
}

export function programResource(section: SectionId, slug: string): Resource<ProgramPage> {
  return {
    key: `kvf:${section}:program:${slug}`,
    ttlMs: TTL.PROGRAM,
    fetcher: jsonFetcher<ProgramPage>(`/api/${SECTIONS[section].apiPath}/programs/${slug}`, keyProgramPage),
  };
}

export function episodeResource(section: SectionId, slug: string, sid: string): Resource<EpisodeDetail> {
  return {
    key: `kvf:${section}:episode:${slug}:${sid}`,
    ttlMs: TTL.EPISODE,
    fetcher: jsonFetcher<EpisodeDetail>(`/api/${SECTIONS[section].apiPath}/episodes/${slug}/${sid}`, (d) => d),
  };
}

/**
 * A day of broadcast schedule for one channel.
 *
 * `date` is null for the initial load so the *server* decides what "today" means
 * in Atlantic/Faroe — the client has no reliable timezone database. Every
 * subsequent day is navigated with the server's own previousDate/nextDate, so
 * only the entry point is ever ambiguous, and its 5-minute TTL rolls it over.
 */
export function scheduleResource(channel: Channel, date: string | null): Resource<SchedulePage> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return {
    key: `kvf:${channel}:schedule:${date ?? "today"}`,
    ttlMs: TTL.SCHEDULE,
    fetcher: jsonFetcher<SchedulePage>(`/api/${channel}/schedule${query}`, keySchedulePage),
  };
}

/**
 * Every program from every section, deduplicated, sorted and tagged with the
 * section that serves it — the search index.
 *
 * There is no search endpoint, so this is *derived* from the front pages rather
 * than fetched: it reuses their cache entries and costs no extra network. Its
 * hash is the joined source hashes, so the merge only re-runs when one of the
 * pages actually changed.
 *
 * Sections are gathered individually rather than with Promise.all: across five
 * sources, one flaky front page emptying the whole index is a question of when,
 * not whether. A failed section contributes an "x" to the hash so that a later
 * success still counts as a change and the merge re-runs.
 */
export function allProgramsResource(): Resource<IndexedProgram[]> {
  const fetcher: ConditionalFetch<IndexedProgram[]> = async (cached): Promise<FetchOutcome<IndexedProgram[]>> => {
    const sources = await Promise.all(
      SECTION_IDS.map(async (id) => {
        try {
          return { id, entry: await ensure(frontPageResource(id)) };
        } catch (err) {
          logger.debug("kvfApi: search index skipping section", { id, err });
          return { id, entry: null };
        }
      }),
    );

    const hash = sources.map((s) => s.entry?.hash ?? "x").join("+");
    if (cached && cached.hash === hash) return { status: "unchanged" };

    const seen = new Set<string>();
    const all: IndexedProgram[] = [];

    for (const { id, entry } of sources) {
      if (!entry) continue;
      for (const cat of entry.data.categories) {
        for (const prog of cat.programs) {
          if (seen.has(prog.slug)) continue;
          seen.add(prog.slug);
          // apiProgramUrl is authoritative — a card on one front page can point
          // at a program served by another section — but it is nullable, so
          // fall back to the page the card came from.
          all.push({ ...prog, sectionId: sectionIdFromApiProgramUrl(prog.apiProgramUrl) ?? id });
        }
      }
    }

    all.sort((a, b) => a.title.localeCompare(b.title));
    return { status: "ok", data: withListKeys(all, (p) => p.slug), meta: { hash } };
  };

  return { key: "kvf:all-programs", ttlMs: TTL.FRONT_PAGE, pinned: true, fetcher };
}

// ── Imperative helpers ─────────────────────────────────────────────────────────

/** Load an episode detail, cache-first. Used when starting playback. */
export async function loadEpisode(section: SectionId, slug: string, sid: string): Promise<EpisodeDetail> {
  const entry = await ensure(episodeResource(section, slug, sid));
  return entry.data;
}

/**
 * Warm an episode into the cache without touching any UI.
 * Called when "Up Next" appears so the transition is instant.
 */
export async function prefetchEpisode(section: SectionId, slug: string, sid: string): Promise<void> {
  try {
    await ensure(episodeResource(section, slug, sid));
  } catch (err) {
    logger.debug("kvfApi: episode prefetch failed", { section, slug, sid, err });
  }
}

/** Resolve a stream URL, from cache when possible. Returns null on failure. */
export async function resolveStreamUrl(section: SectionId, slug: string, sid: string): Promise<string | null> {
  try {
    const detail = await loadEpisode(section, slug, sid);
    return detail.streamUrl;
  } catch (err) {
    logger.warn("kvfApi: stream resolve failed", { section, slug, sid, err });
    return null;
  }
}
