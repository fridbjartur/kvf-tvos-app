import strings from "@/constants/strings.json";
/**
 * KVF Video Player.
 *
 * Accepts a direct HLS streamUrl param (already resolved by the program screen).
 * Uses the play queue from PlayQueueContext to handle "Up Next" and auto-advance.
 */

import { FocusableButton } from "@/components/FocusableButton";
import { UpNextOverlay } from "@/components/up-next-overlay";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { resolveStreamUrl } from "@/services/kvfApi";
import type { Section } from "@/types/kvf";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Video from "react-native-video";
import type { OnLoadData, OnProgressData } from "react-native-video";
import { ActivityIndicator, BackHandler, LogBox, Platform, StyleSheet, Text, TouchableOpacity, View, useTVEventHandler } from "react-native";

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
  const router = useRouter();
  const { hideGlobalLoader } = useLoading();
  const { hasNext, nextEpisode, advance, clear, progress } = usePlayQueue();

  const isLive = params.isLive === "true";
  const safeSection = (params.section === "vit" ? "vit" : "sjon") as Section;

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
    if (isLive) {
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

  useEffect(() => {
    hideGlobalLoader();
  }, [hideGlobalLoader]);

  // ── Wrap callbacks to detect near-end ───────────────────────────────────────
  const wrappedCallbacks = useMemo(() => {
    if (!hasNext) return videoCallbacks;
    return {
      ...videoCallbacks,
      onLoad: (data: OnLoadData) => {
        videoCallbacks.onLoad(data);
        videoDurationRef.current = data.duration;
        upNextThresholdRef.current = Math.min(30, Math.floor(data.duration / 2));
      },
      onProgress: (data: OnProgressData) => {
        videoCallbacks.onProgress(data);
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
  }, [videoCallbacks, hasNext]);

  const handleSkipToNext = useCallback(() => {
    setShowUpNext(false);
    showUpNextRef.current = false;
    handlePlaybackEnd();
  }, [handlePlaybackEnd]);

  const handleBack = useCallback(() => {
    try {
      pause();
    } catch {
      /* ignore */
    }
    clear();
    router.back();
  }, [pause, clear, router]);

  useTVEventHandler(
    useCallback(
      (evt: { eventType: string }) => {
        if (evt.eventType === "menu") handleBack();
      },
      [handleBack],
    ),
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }
  }, [handleBack]);

  // ── Error state ──────────────────────────────────────────────────────────────
  if (state.type === "ERROR") {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>{strings.player.errorTitle}</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <View style={styles.buttonGroup}>
          <FocusableButton title={strings.player.retryButton} onPress={retry} variant="retry" style={styles.button} hasTVPreferredFocus />
          <FocusableButton title={strings.player.goBackButton} onPress={handleBack} variant="secondary" style={styles.button} />
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
          source={{ uri: params.streamUrl }}
          style={styles.video}
          resizeMode="contain"
          controls
          paused={paused}
          allowsExternalPlayback
          {...wrappedCallbacks}
        />
      )}

      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {hasNext && nextEpisode && <UpNextOverlay nextVideoName={nextEpisode.title} progress={progress} onSkip={handleSkipToNext} visible={showUpNext} upNextProgress={upNextProgress} paused={paused} />}

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
