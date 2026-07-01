/**
 * KVF API client.
 *
 * All fetches go through the SWR cache (kvfCache.ts) so callers always get
 * data instantly from cache, with a silent background refresh when stale.
 *
 * Base URL defaults to EXPO_PUBLIC_KVF_API_BASE_URL, falling back to
 * the home NAS API URL, and can be overridden in Settings.
 */

import * as SecureStore from "expo-secure-store";
import type { EpisodeDetail, FrontPage, ProgramCard, ProgramPage, Section } from "@/types/kvf";
import { cacheGet, cacheSet, fetchSWR, TTL } from "./kvfCache";
import { logger } from "@/utils/logger";

const FALLBACK_BASE_URL = "http://192.168.1.10:3939";
const STORE_KEY = "kvf_api_base_url";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const DEFAULT_API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_KVF_API_BASE_URL || FALLBACK_BASE_URL);

let _baseUrl: string = DEFAULT_API_BASE_URL;

// ── Config ─────────────────────────────────────────────────────────────────────

export async function loadApiUrl(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    if (stored) _baseUrl = normalizeBaseUrl(stored);
  } catch {
    // Fall back to default
  }
}

export async function saveApiUrl(url: string): Promise<void> {
  _baseUrl = normalizeBaseUrl(url || DEFAULT_API_BASE_URL);
  await SecureStore.setItemAsync(STORE_KEY, _baseUrl);
}

export function getApiUrl(): string {
  return _baseUrl;
}

// ── Core fetch ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${_baseUrl}${path}`;
  logger.debug("kvfApi: fetch", { url });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

// ── Front pages ────────────────────────────────────────────────────────────────

export async function getSjonPage(opts: { onData: (d: FrontPage) => void; onLoading?: (v: boolean) => void; onError?: (e: unknown) => void }): Promise<void> {
  return fetchSWR({
    key: "kvf:sjon:front",
    ttlMs: TTL.FRONT_PAGE,
    fetcher: () => apiFetch<FrontPage>("/api/sjon"),
    ...opts,
  });
}

export async function getVitPage(opts: { onData: (d: FrontPage) => void; onLoading?: (v: boolean) => void; onError?: (e: unknown) => void }): Promise<void> {
  return fetchSWR({
    key: "kvf:vit:front",
    ttlMs: TTL.FRONT_PAGE,
    fetcher: () => apiFetch<FrontPage>("/api/vit"),
    ...opts,
  });
}

// ── Programs ───────────────────────────────────────────────────────────────────

export async function getProgram(
  section: Section,
  slug: string,
  opts: {
    onData: (d: ProgramPage) => void;
    onLoading?: (v: boolean) => void;
    onError?: (e: unknown) => void;
  },
): Promise<void> {
  return fetchSWR({
    key: `kvf:${section}:program:${slug}`,
    ttlMs: TTL.PROGRAM,
    fetcher: () => apiFetch<ProgramPage>(`/api/${section}/programs/${slug}`),
    ...opts,
  });
}

// ── Episodes ───────────────────────────────────────────────────────────────────

export async function getEpisode(
  section: Section,
  slug: string,
  sid: string,
  opts: {
    onData: (d: EpisodeDetail) => void;
    onLoading?: (v: boolean) => void;
    onError?: (e: unknown) => void;
  },
): Promise<void> {
  return fetchSWR({
    key: `kvf:${section}:episode:${slug}:${sid}`,
    ttlMs: TTL.EPISODE,
    fetcher: () => apiFetch<EpisodeDetail>(`/api/${section}/episodes/${slug}/${sid}`),
    ...opts,
  });
}

/**
 * Eagerly pre-fetch an episode into the cache without triggering any UI update.
 * Call this when showing the "Up Next" overlay to make the transition instant.
 */
export async function prefetchEpisode(section: Section, slug: string, sid: string): Promise<void> {
  const key = `kvf:${section}:episode:${slug}:${sid}`;
  const cached = await cacheGet<EpisodeDetail>(key);
  if (cached) return; // already cached
  try {
    const data = await apiFetch<EpisodeDetail>(`/api/${section}/episodes/${slug}/${sid}`);
    await cacheSet(key, data, TTL.EPISODE);
  } catch (err) {
    logger.warn("kvfApi: prefetch failed", { section, slug, sid, err });
  }
}

// ── Search / all programs ──────────────────────────────────────────────────────

/**
 * Fetch all programs from both sections, deduplicated by slug.
 * Used by the search screen — no dedicated search endpoint exists, so we
 * aggregate from the front-page category lists.
 */
export async function getAllPrograms(): Promise<ProgramCard[]> {
  const [sjon, vit] = await Promise.all([apiFetch<FrontPage>("/api/sjon"), apiFetch<FrontPage>("/api/vit")]);

  const seen = new Set<string>();
  const all: ProgramCard[] = [];

  for (const page of [sjon, vit]) {
    for (const cat of page.categories) {
      for (const prog of cat.programs) {
        if (!seen.has(prog.slug)) {
          seen.add(prog.slug);
          all.push(prog);
        }
      }
    }
  }

  return all.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Resolve a stream URL for an episode — returns from cache if already fetched.
 * Used by the player when advancing to the next episode.
 */
export async function resolveStreamUrl(section: Section, slug: string, sid: string): Promise<string | null> {
  return new Promise((resolve) => {
    getEpisode(section, slug, sid, {
      onData: (d) => resolve(d.streamUrl),
      onError: () => resolve(null),
    });
  });
}
