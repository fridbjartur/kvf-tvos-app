import { LoadingSpinner } from "@/components/loading-spinner";
import strings from "@/constants/strings.json";
/**
 * KVF Video Player.
 *
 * Accepts a direct HLS streamUrl param (already resolved by the program screen).
 * Uses the play queue from PlayQueueContext to handle "Up Next" and auto-advance.
 * Episodes (not live streams) resume where they were left and record progress
 * for Continue Watching; see hooks/useWatchProgress.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { FocusableButton } from "@/components/FocusableButton";
import { UpNextOverlay } from "@/components/up-next-overlay";
import { isSectionId } from "@/constants/sections";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { useWatchProgress } from "@/hooks/useWatchProgress";
import { resolveStreamUrl } from "@/services/kvfApi";
import type { WatchTarget } from "@/services/watchProgressService";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Video from "react-native-video";
import type { OnLoadData, OnPlaybackStateChangedData, OnProgressData } from "react-native-video";
import { AppState, LogBox, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** How long before the end of an episode Up Next appears (at most half the episode). */
const UP_NEXT_LEAD_SECONDS = 20;

LogBox.ignoreLogs(["JS object is no longer associated", "Operation requires a client callback", "Cannot Open", "Failed to load the player item"]);

// A type alias rather than an interface: route params must satisfy expo-router's
// Record<string, string> constraint, which interfaces (no index signature) fail.
type PlayerParams = {
  streamUrl?: string;
  /** Episode title (or channel name for live). */
  title?: string;
  section?: string;
  programSlug?: string;
  episodeSid?: string;
  isLive?: string;
  /** Program title and artwork, carried so Continue Watching can draw the card offline. */
  programTitle?: string;
  /** Episode artwork. */
  thumb?: string;
  /** Program artwork, the fallback for episodes without their own. */
  programThumb?: string;
  /** "true" to ignore saved progress and start from the beginning. */
  fromStart?: string;
};

export default function PlayerScreen() {
  const params = useLocalSearchParams<PlayerParams & { streamUrl: string; title: string }>();
  return <PlayerSession key={`${params.streamUrl}:${params.episodeSid ?? "live"}`} params={params} />;
}

function PlayerSession({ params }: { params: PlayerParams }) {
  const router = useRouter();
  const { hideGlobalLoader } = useLoading();
  const { hasNext, nextEpisode, advance, clear } = usePlayQueue();

  const isLive = params.isLive === "true";

  // ── Watch progress ───────────────────────────────────────────────────────────
  // Only an episode with a full identity is tracked; live streams never are.
  const { section, programSlug, episodeSid, title, programTitle, thumb, programThumb } = params;
  const watchTarget = useMemo<WatchTarget | null>(() => {
    if (isLive || !episodeSid || programSlug === undefined || !isSectionId(section)) return null;
    return { section, slug: programSlug, sid: episodeSid, programTitle: programTitle ?? "", episodeTitle: title ?? "", thumbnailUrl: thumb || programThumb || null };
  }, [isLive, section, programSlug, episodeSid, title, programTitle, thumb, programThumb]);

  // Up Next's episode, under this program's identity, so finishing this one moves the card on.
  const nextTarget = useMemo<WatchTarget | null>(() => {
    if (!watchTarget || !nextEpisode) return null;
    return { ...watchTarget, sid: nextEpisode.sid, episodeTitle: nextEpisode.title, thumbnailUrl: nextEpisode.thumbnailUrl || programThumb || null };
  }, [watchTarget, nextEpisode, programThumb]);

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
  // Seconds left in the episode while Up Next is showing, otherwise null.
  const [upNextSeconds, setUpNextSeconds] = useState<number | null>(null);
  const upNextSecondsRef = useRef<number | null>(null);
  const videoDurationRef = useRef(0);
  const [upNextLead, setUpNextLead] = useState(UP_NEXT_LEAD_SECONDS);
  const showUpNext = upNextSeconds !== null;

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
            // The queue only ever holds this program's episodes; keep its slug so
            // progress for the whole series lands on one Continue Watching card.
            programSlug: programSlug ?? next.slug,
            episodeSid: next.sid,
            programTitle,
            thumb: next.thumbnailUrl ?? undefined,
            programThumb,
          },
        });
      });
    } else {
      clear();
      router.back();
    }
  }, [isLive, hasNext, nextEpisode, advance, clear, router, programSlug, programTitle, programThumb]);

  const { videoRef, paused, state, showLoadingOverlay, videoCallbacks, pause, retry } = useVideoPlayback({ streamUrl: params.streamUrl ?? null, onPlaybackEnd: handlePlaybackEnd });
  // `holdPlayback` keeps a resumed episode paused, behind the loader, until it has seeked.
  const { callbacks: watchProgress, holdPlayback } = useWatchProgress({ target: watchTarget, next: nextTarget, fromStart: params.fromStart === "true", videoRef });
  const source = useMemo(() => ({ uri: params.streamUrl ?? "" }), [params.streamUrl]);

  useEffect(() => {
    hideGlobalLoader();
  }, [hideGlobalLoader]);

  // ── Wrap callbacks for watch progress and to detect near-end ────────────────
  const showsUpNext = !isLive && hasNext;
  const tracksProgress = watchTarget !== null;
  const wrappedCallbacks = useMemo(() => {
    if (!showsUpNext && !tracksProgress) return videoCallbacks;
    return {
      ...videoCallbacks,
      onLoad: (data: OnLoadData) => {
        videoCallbacks.onLoad(data);
        watchProgress.onLoad(data);
        if (!showsUpNext) return;
        videoDurationRef.current = data.duration;
        setUpNextLead(Math.min(UP_NEXT_LEAD_SECONDS, data.duration / 2));
      },
      onProgress: (data: OnProgressData) => {
        watchProgress.onProgress(data);
        if (!showsUpNext) return;
        const duration = videoDurationRef.current;
        // Once the next episode is loading, stray progress events must not re-show it.
        if (duration <= 0 || actionRef.current.transitioning) return;
        const remaining = duration - data.currentTime;
        // Seeking back out of the window hides Up Next again.
        // It stays up at 0 until onEnd starts the next episode.
        const seconds = remaining <= Math.min(UP_NEXT_LEAD_SECONDS, duration / 2) ? Math.max(0, Math.ceil(remaining)) : null;
        if (seconds !== upNextSecondsRef.current) {
          upNextSecondsRef.current = seconds;
          setUpNextSeconds(seconds);
        }
      },
      onSeek: watchProgress.onSeek,
      onPlaybackStateChanged: (data: OnPlaybackStateChangedData) => {
        videoCallbacks.onPlaybackStateChanged(data);
        watchProgress.onPlaybackStateChanged(data);
      },
      onEnd: () => {
        // Recorded before onEnd may navigate to the next episode.
        watchProgress.onEnd();
        videoCallbacks.onEnd();
      },
    };
  }, [videoCallbacks, watchProgress, showsUpNext, tracksProgress]);

  const handleSkipToNext = useCallback(() => {
    pause();
    upNextSecondsRef.current = null;
    setUpNextSeconds(null);
    watchProgress.markWatched();
    handlePlaybackEnd();
  }, [handlePlaybackEnd, pause, watchProgress]);

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
          paused={paused || holdPlayback}
          playInBackground={false}
          playWhenInactive={false}
          allowsExternalPlayback
          {...wrappedCallbacks}
        />
      )}

      {(showLoadingOverlay || holdPlayback) && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner size="large" />
        </View>
      )}

      {!isLive && hasNext && nextEpisode && (
        <UpNextOverlay
          visible={showUpNext}
          title={nextEpisode.title}
          imageUrl={nextEpisode.thumbnailUrl}
          secondsRemaining={upNextSeconds ?? upNextLead}
          leadSeconds={upNextLead}
          onSelect={handleSkipToNext}
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
