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
 * Base URL comes from EXPO_PUBLIC_KVF_API_BASE_URL and falls back to the home
 * NAS. It is fixed at build time — there is no runtime override.
 */

import { SECTION_IDS, SECTIONS, sectionIdFromApiProgramUrl, type Channel, type SectionId } from "@/constants/sections";
import type { EpisodeDetail, FrontPage, IndexedProgram, ProgramPage, SchedulePage } from "@/types/kvf";
import { CacheMeta, ConditionalFetch, contentHash, ensure, FetchOutcome, Resource, setNamespace, TTL } from "./kvfCache";
import { withListKeys } from "@/utils/keys";
import { logger } from "@/utils/logger";
import { retryWithBackoff } from "@/utils/retry";
import { validateEpisode, validateFrontPage, validateProgramPage, validateSchedule } from "./kvfPayload";

const FALLBACK_BASE_URL = "http://192.168.1.10:3939";

/** A stalled request is worse than stale data — fail fast and keep what we have. */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Program pages are the one endpoint that legitimately runs long: the server
 * scrapes an episode listing page by page (see `ProgramPage.pager`), and a
 * long-running series can take the better part of a minute on a cold hit.
 *
 * Ten seconds was not a fast-fail here, it was an unconditional failure — the
 * abort message matches the retry util's "request timeout" pattern, so a slow
 * program burned all three attempts without ever letting one finish.
 */
const PROGRAM_TIMEOUT_MS = 60000;

const RETRY = { maxAttempts: 3, initialDelayMs: 400, maxDelayMs: 2000 };

/**
 * Retrying a request that already ran for a minute just multiplies load on a
 * server that is plainly working. One retry covers a genuine transient failure.
 */
const SLOW_RETRY = { maxAttempts: 2, initialDelayMs: 1000, maxDelayMs: 2000 };

/** Statuses worth a second attempt; everything else fails immediately. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_KVF_API_BASE_URL || FALLBACK_BASE_URL);

// The cache is namespaced by server, so this has to be set before anything is read.
setNamespace(BASE_URL);

// ── HTTP ───────────────────────────────────────────────────────────────────────

type HttpResult = { status: 304 } | { status: 200; raw: string; etag?: string; lastModified?: string };

/**
 * GET with a hard timeout and conditional-request headers.
 *
 * Error messages are phrased to match the retryable patterns in utils/retry.ts,
 * so transient failures back off and permanent ones (404, 400) fail at once.
 */
async function httpGet(path: string, cached: CacheMeta | null, timeoutMs = REQUEST_TIMEOUT_MS): Promise<HttpResult> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      throw new Error(`Request timeout after ${timeoutMs}ms for ${url}`);
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
interface FetchTuning {
  /** Hard abort for one attempt. Defaults to the fast-fail REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
  retry?: typeof RETRY;
}

function jsonFetcher<T>(path: string, transform: (raw: never) => T, tuning: FetchTuning = {}): ConditionalFetch<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, retry = RETRY } = tuning;

  return async (cached) => {
    const res = await retryWithBackoff(() => httpGet(path, cached, timeoutMs), retry);

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
  validateFrontPage(page);
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
  validateProgramPage(page);
  return { ...page, episodes: withListKeys(page.episodes, (e) => e.sid) };
}

function keySchedulePage(page: SchedulePage): SchedulePage {
  validateSchedule(page);
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
    fetcher: jsonFetcher<ProgramPage>(`/api/${SECTIONS[section].apiPath}/programs/${encodeURIComponent(slug)}`, keyProgramPage, {
      timeoutMs: PROGRAM_TIMEOUT_MS,
      retry: SLOW_RETRY,
    }),
  };
}

export function episodeResource(section: SectionId, slug: string, sid: string): Resource<EpisodeDetail> {
  return {
    key: `kvf:${section}:episode:${encodeURIComponent(slug)}:${encodeURIComponent(sid)}`,
    ttlMs: TTL.EPISODE,
    fetcher: jsonFetcher<EpisodeDetail>(`/api/${SECTIONS[section].apiPath}/episodes/${encodeURIComponent(slug)}/${encodeURIComponent(sid)}`, validateEpisode),
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

    if (sources.every((source) => source.entry === null)) {
      throw new Error("Failed to load programs from any section");
    }

    const hash = sources.map((s) => s.entry?.hash ?? "x").join("+");
    if (cached && cached.hash === hash) return { status: "unchanged" };

    const seen = new Set<string>();
    const all: IndexedProgram[] = [];

    for (const { id, entry } of sources) {
      if (!entry) continue;
      for (const prog of [...entry.data.featuredPrograms, ...entry.data.categories.flatMap((cat) => cat.programs)]) {
        const sectionId = sectionIdFromApiProgramUrl(prog.apiProgramUrl) ?? id;
        const identity = `${sectionId}:${prog.slug}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        // apiProgramUrl is authoritative — a card on one front page can point
        // at a program served by another section — but it is nullable, so
        // fall back to the page the card came from.
        all.push({ ...prog, sectionId });
      }
    }

    all.sort((a, b) => a.title.localeCompare(b.title));
    return { status: "ok", data: withListKeys(all, (p) => `${p.sectionId}:${p.slug}`), meta: { hash } };
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
