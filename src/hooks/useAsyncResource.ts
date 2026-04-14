import { useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  reloadToken: number;
};

export function useAsyncResource<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: true,
    reloadToken: 0
  });

  useEffect(() => {
    let cancelled = false;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null
    }));

    load()
      .then((data) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            data,
            isLoading: false,
            error: null
          }));
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: error.message,
            isLoading: false
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.reloadToken, ...deps]);

  function reload() {
    setState((current) => ({
      ...current,
      reloadToken: current.reloadToken + 1
    }));
  }

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    reload
  };
}
