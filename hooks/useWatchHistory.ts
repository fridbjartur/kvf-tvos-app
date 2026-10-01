/**
 * React bindings for watch history.
 *
 * Each hook selects one value from the store, and the store swaps in a new
 * object only when that value changes, so a card re-renders only for its own
 * episode — not every time progress is recorded for another.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { SectionId } from "@/constants/sections";
import { getContinueWatching, getContinueWatchingEntry, getEpisodeProgress, subscribeWatchProgress, type ContinueWatchingEntry, type EpisodeProgress } from "@/services/watchProgressService";

/** Saved progress for one episode, or undefined when it has never been watched. */
export function useEpisodeProgress(section: SectionId, slug: string | undefined, sid: string | undefined): EpisodeProgress | undefined {
  const getSnapshot = useCallback(() => (slug !== undefined && sid ? getEpisodeProgress(section, slug, sid) : undefined), [section, slug, sid]);
  return useSyncExternalStore(subscribeWatchProgress, getSnapshot, getSnapshot);
}

/** The episode a program's Continue Watching card points at. */
export function useContinueWatchingEntry(section: SectionId, slug: string | undefined): ContinueWatchingEntry | undefined {
  const getSnapshot = useCallback(() => (slug !== undefined ? getContinueWatchingEntry(section, slug) : undefined), [section, slug]);
  return useSyncExternalStore(subscribeWatchProgress, getSnapshot, getSnapshot);
}

/** The Continue Watching row, most recently watched first. */
export function useContinueWatching(): ContinueWatchingEntry[] {
  return useSyncExternalStore(subscribeWatchProgress, getContinueWatching, getContinueWatching);
}
