/**
 * KVF episode play queue.
 *
 * Populated from a ProgramPage's episode list when the user taps an episode.
 * The player reads from here to show "Up Next" and auto-advance.
 */

import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from "react";
import type { QueueEpisode } from "@/types/kvf";

interface PlayQueueContextType {
  episodes: QueueEpisode[];
  currentIndex: number;
  hasNext: boolean;
  nextEpisode: QueueEpisode | null;
  progress: string;
  setQueue: (episodes: QueueEpisode[], startIndex: number) => void;
  advance: () => QueueEpisode | null;
  clear: () => void;
}

const PlayQueueContext = createContext<PlayQueueContextType | undefined>(undefined);

export function PlayQueueProvider({ children }: { children: ReactNode }) {
  const [episodes, setEpisodes] = useState<QueueEpisode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const hasNext = useMemo(() => currentIndex >= 0 && currentIndex < episodes.length - 1, [currentIndex, episodes.length]);

  const nextEpisode = useMemo(() => (hasNext ? (episodes[currentIndex + 1] ?? null) : null), [hasNext, episodes, currentIndex]);

  const progress = useMemo(() => {
    if (episodes.length === 0 || currentIndex < 0) return "";
    return `${currentIndex + 1} of ${episodes.length}`;
  }, [episodes.length, currentIndex]);

  const setQueue = useCallback((eps: QueueEpisode[], startIdx: number) => {
    setEpisodes(eps);
    setCurrentIndex(startIdx);
  }, []);

  const advance = useCallback((): QueueEpisode | null => {
    if (currentIndex < 0 || currentIndex >= episodes.length - 1) return null;
    const next = episodes[currentIndex + 1] ?? null;
    setCurrentIndex((i) => i + 1);
    return next;
  }, [currentIndex, episodes]);

  const clear = useCallback(() => {
    setEpisodes([]);
    setCurrentIndex(-1);
  }, []);

  const value = useMemo(
    () => ({ episodes, currentIndex, hasNext, nextEpisode, progress, setQueue, advance, clear }),
    [episodes, currentIndex, hasNext, nextEpisode, progress, setQueue, advance, clear],
  );

  return <PlayQueueContext.Provider value={value}>{children}</PlayQueueContext.Provider>;
}

export function usePlayQueue() {
  const ctx = useContext(PlayQueueContext);
  if (!ctx) throw new Error("usePlayQueue must be used within PlayQueueProvider");
  return ctx;
}
