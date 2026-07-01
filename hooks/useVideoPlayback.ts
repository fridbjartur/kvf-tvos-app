/**
 * KVF video playback hook — simplified for direct HLS streams.
 *
 * KVF API returns ready-to-play m3u8 URLs, so there is no transcoding,
 * codec detection, or Jellyfin session management here. Just clean HLS playback.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoRef, OnLoadData, OnProgressData, OnVideoErrorData } from "react-native-video";
import { logger } from "@/utils/logger";

export type PlaybackState = { type: "LOADING" } | { type: "READY" } | { type: "PLAYING" } | { type: "PAUSED" } | { type: "ERROR"; error: string };

export interface UseVideoPlaybackOptions {
  /** Direct HLS stream URL (m3u8). Playback starts as soon as this is truthy. */
  streamUrl: string | null;
  onPlaybackEnd: () => void;
}

export interface UseVideoPlaybackResult {
  videoRef: React.RefObject<VideoRef>;
  paused: boolean;
  state: PlaybackState;
  showLoadingOverlay: boolean;
  videoCallbacks: {
    onLoad: (data: OnLoadData) => void;
    onProgress: (data: OnProgressData) => void;
    onError: (error: OnVideoErrorData) => void;
    onEnd: () => void;
    onReadyForDisplay: () => void;
  };
  pause: () => void;
  resume: () => void;
  retry: () => void;
}

export function useVideoPlayback({ streamUrl, onPlaybackEnd }: UseVideoPlaybackOptions): UseVideoPlaybackResult {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<PlaybackState>({ type: "LOADING" });
  const [retryCount, setRetryCount] = useState(0);
  const onPlaybackEndRef = useRef(onPlaybackEnd);

  useEffect(() => {
    onPlaybackEndRef.current = onPlaybackEnd;
  }, [onPlaybackEnd]);

  // Reset state when URL changes (new episode).
  useEffect(() => {
    if (streamUrl) {
      setState({ type: "LOADING" });
      setPaused(false);
    }
  }, [streamUrl, retryCount]);

  const onReadyForDisplay = useCallback(() => {
    logger.debug("useVideoPlayback: ready for display");
    setState({ type: "PLAYING" });
  }, []);

  const onLoad = useCallback((_data: OnLoadData) => {
    logger.debug("useVideoPlayback: loaded");
    setState({ type: "READY" });
  }, []);

  const onProgress = useCallback((_data: OnProgressData) => {
    // No-op for now — extend here if you want a watch-progress indicator.
  }, []);

  const onEnd = useCallback(() => {
    logger.debug("useVideoPlayback: ended");
    onPlaybackEndRef.current();
  }, []);

  const onError = useCallback((error: OnVideoErrorData) => {
    const msg =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any)?.error?.localizedDescription ?? (error as unknown as { error?: { localizedDescription?: string } })?.error?.localizedDescription ?? "Playback error";
    logger.warn("useVideoPlayback: error", { msg });
    setState({ type: "ERROR", error: msg });
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
    setState((s) => (s.type === "PLAYING" ? { type: "PAUSED" } : s));
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setState({ type: "PLAYING" });
  }, []);

  const retry = useCallback(() => {
    setState({ type: "LOADING" });
    setPaused(false);
    setRetryCount((c) => c + 1);
  }, []);

  const showLoadingOverlay = state.type === "LOADING" && !!streamUrl;

  return {
    videoRef,
    paused,
    state,
    showLoadingOverlay,
    videoCallbacks: { onLoad, onProgress, onError, onEnd, onReadyForDisplay },
    pause,
    resume,
    retry,
  };
}
