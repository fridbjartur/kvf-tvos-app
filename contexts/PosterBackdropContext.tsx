/**
 * Ambient poster backdrop context.
 *
 * Cards call `dispatch.focus({ uri, cacheKey })` on focus; the AmbientBackground
 * component reads the committed source and crossfades to it.
 */

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface BackdropSource {
  uri: string;
  cacheKey: string;
}

interface BackdropDispatch {
  /** Set the backdrop to this image (debounced to avoid decode thrash during fast scroll). */
  focus: (source: BackdropSource | null) => void;
}

const COMMIT_DELAY_MS = 180;

const DispatchContext = createContext<BackdropDispatch | undefined>(undefined);
const ValueContext = createContext<BackdropSource | null>(null);

export function PosterBackdropProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<BackdropSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback((next: BackdropSource | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSource(next), COMMIT_DELAY_MS);
  }, []);

  const dispatch = useMemo<BackdropDispatch>(() => ({ focus: (s) => commit(s) }), [commit]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <DispatchContext.Provider value={dispatch}>
      <ValueContext.Provider value={source}>{children}</ValueContext.Provider>
    </DispatchContext.Provider>
  );
}

export function usePosterBackdropDispatch(): BackdropDispatch {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("usePosterBackdropDispatch must be used within a PosterBackdropProvider");
  return ctx;
}

export function usePosterBackdropValue(): BackdropSource | null {
  return useContext(ValueContext);
}
