/**
 * Binds a KVF `Resource` to React state.
 *
 * Behaviour:
 *   • Cached data is delivered on the first tick — screens paint populated,
 *     never with a spinner, as long as anything was cached on a previous launch.
 *   • `isLoading` is true only when there is genuinely nothing to show.
 *   • Revalidation is silent. State is touched *only* when the payload changed,
 *     which keeps object identity stable and leaves tvOS focus alone.
 *   • Subscribing to the cache key means screens sharing a resource (or a
 *     refresh driven by kvfPreload) update without issuing their own request.
 *
 * Foreground and interval refreshes are owned centrally by services/kvfPreload,
 * so N mounted screens never fan out into N requests.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe, swr, type Resource } from "@/services/kvfCache";

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

export function useKvfResource<T>(resource: Resource<T> | null, fallbackError = "Failed to load"): KvfResourceState<T> {
  const [held, setHeld] = useState<Held<T>>({ key: null, data: null, loading: false, refreshing: false, error: null });
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
    const initial: Held<T> = { key, data: null, loading: true, refreshing: false, error: null };

    const update = (patch: Partial<Held<T>>) => {
      if (!active) return;
      setHeld((previous) => ({ ...(previous.key === key ? previous : initial), ...patch }));
    };

    const unsubscribe = subscribe<T>(current.key, (entry) => {
      update({ data: entry.data, error: null, loading: false });
    });

    const load = (force: boolean) => {
      const id = ++request;
      update({ error: null, loading: true, refreshing: false });
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
          onRefreshing: (refreshing) => apply({ refreshing }),
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
    };
  }, [key, fallbackError]);

  const refresh = useCallback(() => refreshRef.current?.(), []);
  const matches = held.key === key;
  const data = matches ? held.data : null;

  return {
    data,
    isLoading: key !== null && data === null && (!matches || held.loading),
    isRefreshing: key !== null && matches && held.refreshing,
    error: key !== null && matches && data === null ? held.error : null,
    refresh,
  };
}
