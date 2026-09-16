/**
 * KVF video playback hook — simplified for direct HLS streams.
 *
 * Plays KVF's ready-to-play streams through the platform's native player.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { VideoRef, OnLoadData, OnVideoErrorData, OnPlaybackStateChangedData } from "react-native-video";
import strings from "@/constants/strings.json";
import { logger } from "@/utils/logger";

export type PlaybackState = { type: "LOADING" } | { type: "READY" } | { type: "PLAYING" } | { type: "PAUSED" } | { type: "ERROR"; error: string };

export interface UseVideoPlaybackOptions {
  /** Direct HLS stream URL (m3u8). Playback starts as soon as this is truthy. */
  streamUrl: string | null;
  onPlaybackEnd: () => void;
}

export interface UseVideoPlaybackResult {
  videoRef: React.RefObject<VideoRef | null>;
  paused: boolean;
  state: PlaybackState;
  showLoadingOverlay: boolean;
  videoCallbacks: {
    onLoad: (data: OnLoadData) => void;
    onError: (error: OnVideoErrorData) => void;
    onEnd: () => void;
    onReadyForDisplay: () => void;
    onPlaybackStateChanged: (data: OnPlaybackStateChangedData) => void;
  };
  pause: () => void;
  retry: () => void;
}

export function useVideoPlayback({ streamUrl, onPlaybackEnd }: UseVideoPlaybackOptions): UseVideoPlaybackResult {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(AppState.currentState === "background");
  const [state, setState] = useState<PlaybackState>(streamUrl ? { type: "LOADING" } : { type: "ERROR", error: strings.program.errorNoStream });
  const onPlaybackEndRef = useRef(onPlaybackEnd);

  useEffect(() => {
    onPlaybackEndRef.current = onPlaybackEnd;
  }, [onPlaybackEnd]);

  // Reset state when URL changes (new episode) — "adjust state during render"
  // pattern instead of an effect, so there is no extra cascading render.
  const [prevStreamUrl, setPrevStreamUrl] = useState(streamUrl);
  if (streamUrl !== prevStreamUrl) {
    setPrevStreamUrl(streamUrl);
    setState(streamUrl ? { type: "LOADING" } : { type: "ERROR", error: strings.program.errorNoStream });
    setPaused(!streamUrl || AppState.currentState === "background");
  }

  // Persist the pause across foregrounding: waking the TV alone isn't a Play command.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        setPaused(true);
        setState((previous) => (previous.type === "ERROR" ? previous : { type: "PAUSED" }));
      }
    });
    return () => subscription.remove();
  }, []);

  const onReadyForDisplay = useCallback(() => {
    logger.debug("useVideoPlayback: ready for display");
    setState((previous) => (previous.type === "ERROR" ? previous : { type: paused ? "PAUSED" : "PLAYING" }));
  }, [paused]);

  const onLoad = useCallback((_data: OnLoadData) => {
    logger.debug("useVideoPlayback: loaded");
    setState((previous) => (previous.type === "LOADING" ? { type: "READY" } : previous));
  }, []);

  const onEnd = useCallback(() => {
    logger.debug("useVideoPlayback: ended");
    setPaused(true);
    onPlaybackEndRef.current();
  }, []);

  const onError = useCallback((error: OnVideoErrorData) => {
    const msg = (error as unknown as { error?: { localizedDescription?: string } })?.error?.localizedDescription ?? "Playback error";
    logger.warn("useVideoPlayback: error", { msg });
    setPaused(true);
    setState({ type: "ERROR", error: msg });
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
    setState((s) => (s.type === "PLAYING" ? { type: "PAUSED" } : s));
  }, []);

  const retry = useCallback(() => {
    if (!streamUrl) return;
    setState({ type: "LOADING" });
    setPaused(AppState.currentState === "background");
  }, [streamUrl]);

  const onPlaybackStateChanged = useCallback(({ isPlaying, isSeeking }: OnPlaybackStateChangedData) => {
    if (isSeeking || AppState.currentState === "background") return;
    // Native controls can resume a player that we paused when backgrounding.
    if (isPlaying) setPaused(false);
    setState((previous) => {
      if (previous.type === "ERROR" || previous.type === "LOADING") return previous;
      const type = isPlaying ? "PLAYING" : "PAUSED";
      return previous.type === type ? previous : { type };
    });
  }, []);

  const videoCallbacks = useMemo(() => ({ onLoad, onError, onEnd, onReadyForDisplay, onPlaybackStateChanged }), [onLoad, onError, onEnd, onReadyForDisplay, onPlaybackStateChanged]);

  const showLoadingOverlay = state.type === "LOADING" && !!streamUrl;

  return {
    videoRef,
    paused,
    state,
    showLoadingOverlay,
    videoCallbacks,
    pause,
    retry,
  };
}
