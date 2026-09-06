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

/** Data is stored with the key it belongs to, so a key change can't show stale content. */
interface Held<T> {
  key: string | null;
  data: T | null;
}

export function useKvfResource<T>(resource: Resource<T> | null, fallbackError = "Failed to load"): KvfResourceState<T> {
  const [held, setHeld] = useState<Held<T>>({ key: null, data: null });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The caller rebuilds the resource object every render; only its key
  // identifies it, so hold the latest object in a ref and key the load effect
  // on `key` alone. Depending on `resource` would refetch on every render.
  const resourceRef = useRef(resource);

  // Declared before the load effect, so on the commit where `key` changes the
  // ref is already updated by the time the load below runs.
  useEffect(() => {
    resourceRef.current = resource;
  });

  const key = resource?.key ?? null;

  const load = useCallback(
    (force: boolean) => {
      const current = resourceRef.current;
      if (!current) return;
      void swr(
        current,
        {
          onData: (next) => {
            setHeld({ key: current.key, data: next });
            setError(null);
          },
          onLoading: setLoading,
          onRefreshing: setRefreshing,
          onError: (err) => setError(err instanceof Error ? err.message : fallbackError),
        },
        force,
      );
    },
    [fallbackError],
  );

  useEffect(() => {
    if (!key) return;

    let active = true;

    // Another screen (or kvfPreload) refreshing this key updates us too.
    const unsubscribe = subscribe<T>(key, (entry) => {
      if (active) setHeld({ key, data: entry.data });
    });

    load(false);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, load]);

  const refresh = useCallback(() => load(true), [load]);

  // Derived rather than synced: state left over from a previous key (or from
  // before the resource went null) is never rendered.
  const matches = held.key === key;

  return {
    data: matches ? held.data : null,
    isLoading: key !== null && loading && !(matches && held.data !== null),
    isRefreshing: key !== null && matches && refreshing,
    error: matches && held.data !== null ? null : error,
    refresh,
  };
}
