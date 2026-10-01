/**
 * Records watch progress for the episode on screen, and resumes it.
 *
 * Fed by the player's own callbacks instead of polling the native player:
 * `onProgress` already arrives several times a second for Up Next, so reading
 * `currentTime` from it costs nothing, and the last value is always current
 * when the player closes.
 *
 *   • Resume — the saved position is read once, when the session mounts. The
 *     player is held paused (`holdPlayback`) while it seeks there on load, then
 *     released. Starting at 0 and seeking mid-play leaves AVPlayer paused on
 *     tvOS while the `paused` prop still says false, so nothing would ever tell
 *     it to play again; releasing the hold flips the prop and always starts
 *     playback. It also keeps the first frames of the episode off screen. A
 *     reload after an error returns to where playback had reached instead.
 *   • Every SAVE_INTERVAL_SECONDS of movement, seeks included, the position is
 *     recorded in memory; the store persists it on its own throttle.
 *   • Pausing, finishing, skipping to the next episode and closing the player
 *     record at once and flush to storage. Leaving the foreground is flushed
 *     by the store's own AppState listener (startWatchProgressSync).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnLoadData, OnPlaybackStateChangedData, OnProgressData, VideoRef } from "react-native-video";
import { flushWatchProgress, getResumePosition, markCompleted, MIN_POSITION_SECONDS, recordProgress, type WatchTarget } from "@/services/watchProgressService";

const SAVE_INTERVAL_SECONDS = 5;

/** A slow seek must never leave the player stuck: start anyway after this. */
const RESUME_SEEK_TIMEOUT_MS = 4000;

/** A progress sample this close to the resume target means the seek has landed. */
const SEEK_LANDED_TOLERANCE_SECONDS = 2;

interface UseWatchProgressConfig {
  /** Null disables tracking: live streams, or an episode without a stable identity. */
  target: WatchTarget | null;
  /** The episode Up Next would play, so finishing this one moves the row on to it. */
  next: WatchTarget | null;
  /** Start from the beginning even when there is saved progress. */
  fromStart?: boolean;
  videoRef: React.RefObject<VideoRef | null>;
}

export interface WatchProgressCallbacks {
  onLoad: (data: OnLoadData) => void;
  onProgress: (data: OnProgressData) => void;
  onSeek: () => void;
  onPlaybackStateChanged: (data: OnPlaybackStateChangedData) => void;
  onEnd: () => void;
  /** The viewer moved on to the next episode, which counts as finishing this one. */
  markWatched: () => void;
}

export interface UseWatchProgressResult {
  /** Stable for the session's lifetime. */
  callbacks: WatchProgressCallbacks;
  /** Keep the player paused (and covered) until the resume seek has landed. */
  holdPlayback: boolean;
}

export function useWatchProgress({ target, next, fromStart = false, videoRef }: UseWatchProgressConfig): UseWatchProgressResult {
  const targetRef = useRef(target);
  const nextRef = useRef(next);
  useEffect(() => {
    targetRef.current = target;
    nextRef.current = next;
  }, [target, next]);

  // Read once: the player session is keyed per episode, and re-reading after
  // the first save would only chase our own writes.
  const [resumeAt] = useState(() => (target && !fromStart ? getResumePosition(target.section, target.slug, target.sid) : null));

  const durationRef = useRef(0);
  const positionRef = useRef(0);
  const savedAtRef = useRef(resumeAt ?? 0);
  const finishedRef = useRef(false);

  // ── Resume hold ──────────────────────────────────────────────────────────────
  const [holdPlayback, setHoldPlayback] = useState(resumeAt !== null);
  const holdingRef = useRef(resumeAt !== null);
  const pendingSeekRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pendingSeekRef.current = null;
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setHoldPlayback(false);
  }, []);

  const save = useCallback(() => {
    const current = targetRef.current;
    if (!current || finishedRef.current) return;
    savedAtRef.current = positionRef.current;
    recordProgress(current, positionRef.current, durationRef.current, nextRef.current);
  }, []);

  const finish = useCallback(() => {
    const current = targetRef.current;
    if (!current || finishedRef.current) return;
    finishedRef.current = true;
    markCompleted(current, durationRef.current, nextRef.current);
    void flushWatchProgress();
  }, []);

  // Closing the player is the last chance to record where the viewer stopped.
  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      save();
      void flushWatchProgress();
    },
    [save],
  );

  const onLoad = useCallback(
    (data: OnLoadData) => {
      if (!targetRef.current) return;
      if (Number.isFinite(data.duration) && data.duration > 0) durationRef.current = data.duration;

      const seekTo = positionRef.current >= MIN_POSITION_SECONDS ? positionRef.current : resumeAt;
      const duration = durationRef.current;
      if (seekTo === null || seekTo <= 0 || (duration > 0 && seekTo >= duration - 1)) {
        release();
        return;
      }

      holdingRef.current = true;
      pendingSeekRef.current = seekTo;
      setHoldPlayback(true);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(release, RESUME_SEEK_TIMEOUT_MS);
      videoRef.current?.seek(seekTo);
    },
    [resumeAt, videoRef, release],
  );

  const onSeek = useCallback(() => {
    if (holdingRef.current) release();
  }, [release]);

  const onProgress = useCallback(
    (data: OnProgressData) => {
      const time = data.currentTime;
      if (!targetRef.current || !Number.isFinite(time) || time < 0) return;

      if (holdingRef.current) {
        // Samples from before the resume seek lands are the episode's start,
        // not where the viewer is — never record them.
        const pending = pendingSeekRef.current;
        if (pending === null || Math.abs(time - pending) > SEEK_LANDED_TOLERANCE_SECONDS) return;
        release();
      }

      // Streams that report no duration on load still report a seekable range.
      if (durationRef.current <= 0 && Number.isFinite(data.seekableDuration) && data.seekableDuration > 0) durationRef.current = data.seekableDuration;

      positionRef.current = time;
      if (Math.abs(time - savedAtRef.current) >= SAVE_INTERVAL_SECONDS) save();
    },
    [save, release],
  );

  const onPlaybackStateChanged = useCallback(
    ({ isPlaying, isSeeking }: OnPlaybackStateChangedData) => {
      if (isPlaying || isSeeking || holdingRef.current || !targetRef.current) return;
      // Paused: the viewer may walk away or the TV may sleep, so write now.
      save();
      void flushWatchProgress();
    },
    [save],
  );

  const callbacks = useMemo(() => ({ onLoad, onProgress, onSeek, onPlaybackStateChanged, onEnd: finish, markWatched: finish }), [onLoad, onProgress, onSeek, onPlaybackStateChanged, finish]);

  return { callbacks, holdPlayback };
}
