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

export function useKvfResource<T>(resource: Resource<T> | null, fallbackError = "Failed to load"): KvfResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The caller rebuilds the resource object every render; only its key
  // identifies it, so hold the latest object in a ref and key the effect on
  // `key` alone. Depending on `resource` would refetch on every render.
  const resourceRef = useRef(resource);
  resourceRef.current = resource;

  const key = resource?.key ?? null;

  const load = useCallback(
    (force: boolean) => {
      const current = resourceRef.current;
      if (!current) return;
      void swr(
        current,
        {
          onData: (next) => setData(() => next),
          onLoading: setIsLoading,
          onRefreshing: setIsRefreshing,
          onError: (err) => setError(err instanceof Error ? err.message : fallbackError),
        },
        force,
      );
    },
    [fallbackError],
  );

  useEffect(() => {
    if (!key) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setError(null);

    // Another screen (or kvfPreload) refreshing this key updates us too.
    const unsubscribe = subscribe<T>(key, (entry) => {
      if (active) setData(() => entry.data);
    });

    load(false);

    return () => {
      active = false;
      unsubscribe();
    };
    // `load` is stable and `resourceRef` carries the rest — see note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A successful load clears a stale error banner.
  useEffect(() => {
    if (data !== null) setError(null);
  }, [data]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, isLoading, isRefreshing, error, refresh };
}
