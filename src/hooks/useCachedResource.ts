import { useCallback, useEffect, useRef, useState } from "react";
import { dataCache } from "../lib/dataCache";

type State<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

/**
 * Stale-while-revalidate data fetcher backed by an in-memory cache.
 *
 * Behaviour on mount:
 *  - Fresh cache hit  → return data immediately, no network request.
 *  - Stale cache hit  → return stale data immediately, fetch in background.
 *  - Cache miss       → show loading skeleton, fetch, then show data.
 *
 * Behaviour on network error:
 *  - Stale data exists  → silently keep showing it (no error screen shown).
 *  - No data at all     → surface the error message.
 *
 * `freshMs` controls how long a successful response counts as "fresh".
 * After that window the cache entry is still used as a stale fallback but a
 * background re-fetch is triggered on the next mount.
 */
export function useCachedResource<T>(
  cacheKey: string,
  load: () => Promise<T>,
  freshMs: number
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>(() => {
    const stale = dataCache.getStale<T>(cacheKey);
    return {
      data: stale,
      error: null,
      isLoading: stale === null,
      isRefreshing: stale !== null
    };
  });

  // reloadToken increments on explicit user-triggered refresh.
  // We keep it outside the main state to avoid double-renders.
  const [reloadToken, setReloadToken] = useState(0);

  // Always have access to the latest `load` fn without invalidating the effect.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    // On regular mounts (not explicit reload), honour the freshness window.
    if (reloadToken === 0) {
      const fresh = dataCache.getFresh<T>(cacheKey, freshMs);
      if (fresh !== null) {
        setState({ data: fresh, error: null, isLoading: false, isRefreshing: false });
        return;
      }
    }

    // We need to fetch. Decide whether to show a full-screen skeleton or a
    // subtle background-refresh indicator depending on whether we have stale data.
    const stale = dataCache.getStale<T>(cacheKey);
    setState((prev) => ({
      data: stale ?? prev.data,
      error: null,
      isLoading: stale === null && prev.data === null,
      isRefreshing: stale !== null || prev.data !== null
    }));

    let cancelled = false;

    loadRef
      .current()
      .then((freshData) => {
        if (cancelled) return;
        dataCache.set(cacheKey, freshData);
        setState({ data: freshData, error: null, isLoading: false, isRefreshing: false });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((prev) => ({
          // Keep any data we already had — don't replace a good screen with an error.
          data: prev.data,
          error: prev.data !== null ? null : err.message,
          isLoading: false,
          isRefreshing: false
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, freshMs, reloadToken]);

  const reload = useCallback(() => {
    // Expire forces a background re-fetch on the next mount or right now,
    // while keeping stale data visible so the screen doesn't blank out.
    dataCache.expire(cacheKey);
    setReloadToken((t) => t + 1);
  }, [cacheKey]);

  return { ...state, reload };
}
