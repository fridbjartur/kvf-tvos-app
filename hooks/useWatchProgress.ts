import { useEffect, useRef, useCallback } from "react";
import type { VideoRef } from "react-native-video";
import { saveProgress, clearProgress } from "@/services/watchProgressService";
import { logger } from "@/utils/logger";

const POLL_INTERVAL_MS = 8_000;
const MIN_SAVE_DELTA_SECONDS = 5;

interface UseWatchProgressConfig {
  videoId: string;
  videoRef: React.RefObject<VideoRef | null>;
  durationRef: React.RefObject<number>;
}

interface UseWatchProgressResult {
  markEnded: () => void;
}

/**
 * Self-contained hook that polls the native player for watch progress
 * and saves it periodically. Completely decoupled from the playback state machine.
 *
 * Behavior (8-second polling loop):
 * 1. Call videoRef.current.getCurrentPosition() to get current position
 * 2. Compare with last sampled position — if not advancing (paused/buffering), skip
 * 3. Compare with last saved position — if < 5s difference, skip (no noise saves)
 * 4. Call saveProgress(videoId, position, duration)
 *
 * Cleanup on unmount/videoId change:
 * - Clear the interval
 * - Save final position (unless video ended naturally via markEnded())
 *
 * markEnded():
 * - Sets internal ended flag
 * - Calls clearProgress(videoId) — video is finished, no resume needed
 */
export function useWatchProgress({ videoId, videoRef, durationRef }: UseWatchProgressConfig): UseWatchProgressResult {
  const lastSavedPositionRef = useRef(0);
  const lastSampledPositionRef = useRef(0);
  const endedRef = useRef(false);

  // Stable ref for videoId — used in markEnded to avoid stale closures
  const videoIdRef = useRef(videoId);
  videoIdRef.current = videoId;

  // Reset state when videoId changes
  useEffect(() => {
    lastSavedPositionRef.current = 0;
    lastSampledPositionRef.current = 0;
    endedRef.current = false;
  }, [videoId]);

  // Polling loop
  useEffect(() => {
    const currentVideoId = videoId; // Capture for cleanup closure

    const interval = setInterval(async () => {
      if (endedRef.current) return;

      try {
        const position = await videoRef.current?.getCurrentPosition();
        if (position == null || position <= 0) return;

        // Not advancing — player is paused or buffering
        if (position === lastSampledPositionRef.current) return;
        lastSampledPositionRef.current = position;

        // Not enough change since last save — avoid noise
        if (Math.abs(position - lastSavedPositionRef.current) < MIN_SAVE_DELTA_SECONDS) return;

        await saveProgress(currentVideoId, position, durationRef.current);
        lastSavedPositionRef.current = position;
      } catch {
        // getCurrentPosition can throw if player is disposed — ignore silently
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);

      // Save final position on cleanup (unless video ended naturally)
      if (!endedRef.current && lastSampledPositionRef.current > 0) {
        saveProgress(currentVideoId, lastSampledPositionRef.current, durationRef.current);
      }
    };
  }, [videoId, videoRef, durationRef]);

  const markEnded = useCallback(() => {
    endedRef.current = true;
    clearProgress(videoIdRef.current);
    logger.info("Video ended, progress cleared", {
      service: "useWatchProgress",
      videoId: videoIdRef.current.substring(0, 8),
    });
  }, []);

  return { markEnded };
}
