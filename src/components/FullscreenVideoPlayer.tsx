import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useEpisodeDetail } from "../hooks/useEpisodeDetail";
import { palette, spacing, type } from "../theme";
import {
  getBackLabel,
  getPlaybackLoadErrorTitle,
  getPlaybackUnavailableBody,
  getPlaybackUnavailableTitle,
  getRetryLabel,
} from "../utils/content";
import { Button } from "./Button";
import { LoadingSpinner } from "./LoadingSpinner";

type DirectPlayback = {
  kind: "stream";
  streamUrl: string;
};

type EpisodePlayback = {
  kind: "episode";
  section: "sjon" | "vit";
  slug: string;
  sid: string;
  initialTime?: number;
};

export type PlaybackRequest = DirectPlayback | EpisodePlayback;

type FullscreenVideoPlayerProps = {
  playback: PlaybackRequest;
  onClose: (currentTime?: number) => void;
};

export function FullscreenVideoPlayer({
  playback,
  onClose,
}: FullscreenVideoPlayerProps) {
  if (playback.kind === "stream") {
    return (
      <ManagedVideoPlayback
        source={playback.streamUrl}
        onClose={onClose}
      />
    );
  }

  return (
    <EpisodeVideoPlayback
      initialTime={playback.initialTime}
      onClose={onClose}
      section={playback.section}
      sid={playback.sid}
      slug={playback.slug}
    />
  );
}

function EpisodeVideoPlayback({
  section,
  slug,
  sid,
  initialTime = 0,
  onClose,
}: {
  section: "sjon" | "vit";
  slug: string;
  sid: string;
  initialTime?: number;
  onClose: (currentTime?: number) => void;
}) {
  const { data, error, isLoading, reload } = useEpisodeDetail(section, slug, sid);

  if (isLoading) {
    return (
      <View style={styles.overlay}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <MessageOverlay
        body={error}
        onClose={() => onClose(initialTime)}
        onRetry={reload}
        title={getPlaybackLoadErrorTitle()}
      />
    );
  }

  if (!data?.playbackAvailable || !data.streamUrl) {
    return (
      <MessageOverlay
        body={getPlaybackUnavailableBody()}
        onClose={() => onClose(initialTime)}
        title={getPlaybackUnavailableTitle()}
      />
    );
  }

  return (
    <ManagedVideoPlayback
      initialTime={initialTime}
      onClose={onClose}
      source={data.streamUrl}
    />
  );
}

function ManagedVideoPlayback({
  source,
  initialTime = 0,
  onClose,
}: {
  source: string;
  initialTime?: number;
  onClose: (currentTime?: number) => void;
}) {
  const videoRef = useRef<VideoView>(null);
  const hasEnteredFullscreen = useRef(false);
  const hasAppliedInitialTime = useRef(false);
  const player = useVideoPlayer(source);
  const [status, setStatus] = useState<VideoPlayerStatus>(player.status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const statusSubscription = player.addListener("statusChange", (payload) => {
      setStatus(payload.status);
      if (payload.status === "error") {
        setError(payload.error?.message ?? getPlaybackLoadErrorTitle());
      }
    });

    return () => {
      statusSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (status !== "readyToPlay" || hasEnteredFullscreen.current) {
      return;
    }

    if (initialTime > 0 && !hasAppliedInitialTime.current) {
      player.currentTime = initialTime;
      hasAppliedInitialTime.current = true;
    }

    const timer = setTimeout(() => {
      videoRef.current?.enterFullscreen();
      player.play();
      hasEnteredFullscreen.current = true;
    }, 150);

    return () => clearTimeout(timer);
  }, [initialTime, player, status]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Best effort pause when the overlay is dismissed or unmounted.
      }
    };
  }, [player]);

  function handleClose() {
    const currentTime = player.currentTime;

    try {
      player.pause();
    } catch {
      // Preserve the last known time even if pause throws during teardown.
    }

    onClose(currentTime);
  }

  if (error) {
    return (
      <MessageOverlay
        body={error}
        onClose={handleClose}
        title={getPlaybackLoadErrorTitle()}
      />
    );
  }

  return (
    <View style={styles.overlay}>
      <VideoView
        ref={videoRef}
        allowsFullscreen
        contentFit="contain"
        nativeControls
        onFullscreenExit={handleClose}
        player={player}
        style={styles.video}
      />
      {status !== "readyToPlay" ? (
        <View style={styles.loaderOverlay}>
          <LoadingSpinner />
        </View>
      ) : null}
    </View>
  );
}

function MessageOverlay({
  title,
  body,
  onClose,
  onRetry,
}: {
  title: string;
  body: string;
  onClose: () => void;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.messagePanel}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorBody}>{body}</Text>
        <View style={styles.actions}>
          {onRetry ? <Button label={getRetryLabel()} onPress={onRetry} size="md" /> : null}
          <Button label={getBackLabel()} onPress={onClose} size="md" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
    zIndex: 20,
  },
  video: {
    width: 1,
    height: 1,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  messagePanel: {
    width: "100%",
    maxWidth: 760,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
    textAlign: "center",
  },
  errorBody: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});
