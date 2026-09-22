import { LoadingSpinner } from "@/components/loading-spinner";
import strings from "@/constants/strings.json";
/**
 * KVF Video Player.
 *
 * Accepts a direct HLS streamUrl param (already resolved by the program screen).
 * Uses the play queue from PlayQueueContext to handle "Up Next" and auto-advance.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { FocusableButton } from "@/components/FocusableButton";
import { UpNextOverlay } from "@/components/up-next-overlay";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { resolveStreamUrl } from "@/services/kvfApi";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Video from "react-native-video";
import type { OnLoadData, OnProgressData } from "react-native-video";
import { AppState, LogBox, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

LogBox.ignoreLogs(["JS object is no longer associated", "Operation requires a client callback", "Cannot Open", "Failed to load the player item"]);

export default function PlayerScreen() {
  const params = useLocalSearchParams<{
    streamUrl: string;
    title: string;
    section?: string;
    programSlug?: string;
    episodeSid?: string;
    isLive?: string;
  }>();
  return <PlayerSession key={`${params.streamUrl}:${params.episodeSid ?? "live"}`} params={params} />;
}

function PlayerSession({ params }: { params: { streamUrl?: string; title?: string; section?: string; programSlug?: string; episodeSid?: string; isLive?: string } }) {
  const router = useRouter();
  const { hideGlobalLoader } = useLoading();
  const { hasNext, nextEpisode, advance, clear, progress } = usePlayQueue();

  const isLive = params.isLive === "true";
  const actionRef = useRef({ active: true, transitioning: false });
  useFocusEffect(
    useCallback(() => {
      const action = { active: true, transitioning: false };
      actionRef.current = action;
      return () => {
        action.active = false;
      };
    }, []),
  );

  // ── Up-next state ────────────────────────────────────────────────────────────
  const [showUpNext, setShowUpNext] = useState(false);
  const showUpNextRef = useRef(false);
  const videoDurationRef = useRef(0);
  const [upNextProgress, setUpNextProgress] = useState(1);
  const upNextThresholdRef = useRef(30);

  // Pre-fetch next episode stream URL when up-next becomes visible.
  useEffect(() => {
    if (showUpNext && nextEpisode) {
      resolveStreamUrl(nextEpisode.section, nextEpisode.slug, nextEpisode.sid);
    }
  }, [showUpNext, nextEpisode]);

  // ── Playback end ─────────────────────────────────────────────────────────────
  const handlePlaybackEnd = useCallback(() => {
    const action = actionRef.current;
    if (!action.active || action.transitioning || (AppState.currentState !== null && AppState.currentState !== "active")) return;
    action.transitioning = true;
    if (isLive) {
      clear();
      router.back();
      return;
    }

    if (hasNext && nextEpisode) {
      const next = advance();
      if (!next) {
        clear();
        router.back();
        return;
      }

      resolveStreamUrl(next.section, next.slug, next.sid).then((url) => {
        if (!action.active) return;
        // A lookup finishing while the TV sleeps must not start another episode.
        if (AppState.currentState !== null && AppState.currentState !== "active") {
          clear();
          return;
        }
        if (!url) {
          clear();
          router.back();
          return;
        }
        router.replace({
          pathname: "/player",
          params: {
            streamUrl: url,
            title: next.title,
            section: next.section,
            programSlug: next.slug,
            episodeSid: next.sid,
          },
        });
      });
    } else {
      clear();
      router.back();
    }
  }, [isLive, hasNext, nextEpisode, advance, clear, router]);

  const { videoRef, paused, state, showLoadingOverlay, videoCallbacks, pause, retry } = useVideoPlayback({ streamUrl: params.streamUrl ?? null, onPlaybackEnd: handlePlaybackEnd });
  const source = useMemo(() => ({ uri: params.streamUrl ?? "" }), [params.streamUrl]);

  useEffect(() => {
    hideGlobalLoader();
  }, [hideGlobalLoader]);

  // ── Wrap callbacks to detect near-end ───────────────────────────────────────
  const wrappedCallbacks = useMemo(() => {
    if (isLive || !hasNext) return videoCallbacks;
    return {
      ...videoCallbacks,
      onLoad: (data: OnLoadData) => {
        videoCallbacks.onLoad(data);
        videoDurationRef.current = data.duration;
        upNextThresholdRef.current = Math.min(30, data.duration / 2);
      },
      onProgress: (data: OnProgressData) => {
        if (videoDurationRef.current > 0) {
          const remaining = videoDurationRef.current - data.currentTime;
          const shouldShow = remaining <= upNextThresholdRef.current && remaining > 0;
          if (shouldShow !== showUpNextRef.current) {
            showUpNextRef.current = shouldShow;
            setShowUpNext(shouldShow);
          }
          if (showUpNextRef.current) {
            setUpNextProgress(Math.max(0, remaining / upNextThresholdRef.current));
          }
        }
      },
    };
  }, [videoCallbacks, hasNext, isLive]);

  const handleSkipToNext = useCallback(() => {
    pause();
    setShowUpNext(false);
    showUpNextRef.current = false;
    handlePlaybackEnd();
  }, [handlePlaybackEnd, pause]);

  const handleBack = useCallback(() => {
    if (!actionRef.current.active) return;
    actionRef.current.active = false;
    try {
      pause();
    } catch {
      /* ignore */
    }
    clear();
    router.back();
  }, [pause, clear, router]);

  useScreenBack(handleBack);

  // ── Error state ──────────────────────────────────────────────────────────────
  if (state.type === "ERROR") {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>{strings.player.errorTitle}</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <View style={styles.buttonGroup}>
          <FocusableButton title={strings.player.retryButton} onPress={retry} style={styles.button} hasTVPreferredFocus />
          <FocusableButton title={strings.player.goBackButton} onPress={handleBack} style={styles.button} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {params.streamUrl && (
        <Video
          key={params.streamUrl}
          ref={videoRef}
          source={source}
          style={styles.video}
          resizeMode="contain"
          controls
          paused={paused}
          playInBackground={false}
          playWhenInactive={false}
          allowsExternalPlayback
          {...wrappedCallbacks}
        />
      )}

      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner size="large" />
        </View>
      )}

      {!isLive && hasNext && nextEpisode && (
        <UpNextOverlay
          nextVideoName={nextEpisode.title}
          progress={progress}
          onSkip={handleSkipToNext}
          visible={showUpNext}
          upNextProgress={upNextProgress}
          paused={paused || state.type === "PAUSED"}
        />
      )}

      {!Platform.isTV && (
        <TouchableOpacity style={styles.iosBackButton} onPress={handleBack}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1, width: "100%", height: "100%" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 100,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    fontSize: 18,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 26,
  },
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 32 : 24,
    alignItems: "center",
  },
  button: { minWidth: Platform.isTV ? 300 : 250 },
  iosBackButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
