/**
 * Binds a KVF `Resource` to React state.
 *
 * Behaviour:
 *   • Cached data is delivered on the first tick — screens paint populated,
 *     never with a spinner, as long as anything was cached on a previous launch.
 *     When the payload is still in RAM it is read *synchronously*, so a warm
 *     screen never renders even a single spinner frame.
 *   • `isLoading` is true only when there is genuinely nothing to show.
 *   • `isRefreshing` tracks the cache's in-flight state, so it is true for
 *     *every* revalidation of the key — including the central ones kvfPreload
 *     drives, which this hook never initiates and previously could not see.
 *   • Revalidation is otherwise silent. Data state is touched only when the
 *     payload changed, which keeps object identity stable and leaves tvOS focus
 *     alone.
 *   • Subscribing to the cache key means screens sharing a resource (or a
 *     refresh driven by kvfPreload) update without issuing their own request.
 *
 * Foreground and interval refreshes are owned centrally by services/kvfPreload,
 * so N mounted screens never fan out into N requests.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cachePeek, isRevalidating, subscribe, subscribeStatus, swr, type Resource } from "@/services/kvfCache";

export interface KvfResourceState<T> {
  data: T | null;
  /** Nothing cached and a first fetch is in flight. */
  isLoading: boolean;
  /** Data is on screen while a background revalidation runs. */
  isRefreshing: boolean;
  /** Only set when there is no data to fall back on. */
  error: string | null;
  refresh: () => void;
}

/** Keep data and request status together so switching keys cannot leak either. */
interface Held<T> {
  key: string | null;
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

/**
 * Starting state for a key, seeded from the memory tier.
 *
 * Peeking here is what removes the spinner flash on a warm screen: without it
 * the first render always has `data === null`, because the cache read is async.
 */
function seed<T>(key: string | null): Held<T> {
  if (!key) return { key: null, data: null, loading: false, refreshing: false, error: null };

  const data = cachePeek<T>(key);
  return { key, data, loading: data === null, refreshing: data !== null && isRevalidating(key), error: null };
}

export function useKvfResource<T>(resource: Resource<T> | null, fallbackError = "Failed to load"): KvfResourceState<T> {
  const [held, setHeld] = useState<Held<T>>(() => seed<T>(resource?.key ?? null));
  const resourceRef = useRef(resource);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    resourceRef.current = resource;
  });

  const key = resource?.key ?? null;

  useEffect(() => {
    const current = resourceRef.current;
    if (!current) return;

    let active = true;
    let request = 0;
    const initial = seed<T>(key);

    const update = (patch: Partial<Held<T>>) => {
      if (!active) return;
      setHeld((previous) => ({ ...(previous.key === key ? previous : initial), ...patch }));
    };

    const unsubscribe = subscribe<T>(current.key, (entry) => {
      update({ data: entry.data, error: null, loading: false });
    });

    // Revalidation status comes from the cache rather than from this hook's own
    // `swr` call, because the refresh that matters most — kvfPreload's interval
    // and foreground sweep — is started elsewhere and would otherwise be
    // invisible here. That silent swap is what made new episodes "just appear".
    const unsubscribeStatus = subscribeStatus(current.key, (refreshing) => update({ refreshing }));

    const load = (force: boolean) => {
      const id = ++request;
      update({ error: null });
      const apply = (patch: Partial<Held<T>>) => {
        if (id === request) update(patch);
      };
      // Cache work may finish after a route change. Every callback, including
      // loading/error callbacks, belongs to this effect and this request only.
      void swr(
        current,
        {
          onData: (data) => apply({ data, error: null, loading: false }),
          onLoading: (loading) => apply({ loading }),
          onError: (err) => apply({ error: err instanceof Error ? err.message : fallbackError }),
        },
        force,
      );
    };

    refreshRef.current = () => load(true);
    load(false);

    return () => {
      active = false;
      refreshRef.current = null;
      unsubscribe();
      unsubscribeStatus();
    };
  }, [key, fallbackError]);

  const refresh = useCallback(() => refreshRef.current?.(), []);
  const matches = held.key === key;

  // On a key change the effect has not run yet, so fall back to the memory tier
  // for this render — navigating to an already-warmed program paints instantly.
  const data = matches ? held.data : key ? cachePeek<T>(key) : null;
  const refreshing = matches ? held.refreshing : key !== null && isRevalidating(key);

  return {
    data,
    isLoading: key !== null && data === null && (!matches || held.loading),
    isRefreshing: key !== null && data !== null && refreshing,
    error: key !== null && matches && data === null ? held.error : null,
    refresh,
  };
}
