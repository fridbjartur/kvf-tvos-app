import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Screen } from "../components/Screen";
import { useEpisodeDetail } from "../hooks/useEpisodeDetail";
import type { RootStackParamList } from "../navigation/types";
import { palette, radii, spacing, type } from "../theme";
import {
  formatPublishDate,
  getBackLabel,
  getPlaybackLoadErrorTitle,
  getPlaybackUnavailableBody,
  getPlaybackUnavailableTitle,
  getRetryLabel,
  getSectionLabel,
} from "../utils/content";

type Props = NativeStackScreenProps<RootStackParamList, "Playback">;

export function PlaybackScreen({ navigation, route }: Props) {
  const { section, slug, sid } = route.params;
  const { data, error, isLoading, reload } = useEpisodeDetail(section, slug, sid);
  const videoRef = useRef<VideoView>(null);
  const player = useVideoPlayer(data?.streamUrl ?? "", (instance) => {
    if (data?.streamUrl) {
      instance.play();
    }
  });

  useEffect(() => {
    if (!data?.playbackAvailable || !data.streamUrl) {
      return;
    }

    const timer = setTimeout(() => {
      videoRef.current?.enterFullscreen();
      player.play();
    }, 150);

    return () => clearTimeout(timer);
  }, [data?.playbackAvailable, data?.streamUrl, player]);

  return (
    <Screen showTopBar={false}>
      {isLoading ? <LoadingSkeleton /> : null}
      {!isLoading && error ? (
        <View style={styles.centerPanel}>
          <Text style={styles.label}>{getSectionLabel(section)}</Text>
          <Text style={styles.title}>{getPlaybackLoadErrorTitle()}</Text>
          <Text style={styles.copy}>{error}</Text>
          <Text onPress={reload} style={styles.actionText}>
            {getRetryLabel()}
          </Text>
        </View>
      ) : null}
      {!isLoading && !error && data ? (
        <View style={styles.layout}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backText}>{getBackLabel()}</Text>
            </Pressable>
            <View style={styles.meta}>
              <Text style={styles.label}>{getSectionLabel(data.section)}</Text>
              <Text style={styles.title}>{data.title}</Text>
              <Text style={styles.copy}>{formatPublishDate(data.publishDate)}</Text>
            </View>
          </View>
          {data.playbackAvailable && data.streamUrl ? (
            <VideoView
              ref={videoRef}
              allowsFullscreen
              contentFit="contain"
              nativeControls
              onFullscreenExit={() => navigation.goBack()}
              player={player}
              style={styles.video}
            />
          ) : (
            <View style={styles.unavailablePanel}>
              <Text style={styles.unavailableTitle}>{getPlaybackUnavailableTitle()}</Text>
              <Text style={styles.copy}>
                {getPlaybackUnavailableBody()}
              </Text>
              <Text style={styles.sourceText}>{data.sourceEpisodeUrl}</Text>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    paddingVertical: spacing.lg,
    gap: spacing.lg
  },
  header: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center"
  },
  backButton: {
    backgroundColor: palette.panel,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backText: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: "800"
  },
  meta: {
    gap: 4
  },
  label: {
    color: palette.focus,
    fontSize: type.body,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2
  },
  title: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900"
  },
  copy: {
    color: palette.textMuted,
    fontSize: type.body
  },
  video: {
    flex: 1,
    backgroundColor: "#000"
  },
  unavailablePanel: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.sm
  },
  unavailableTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900"
  },
  sourceText: {
    color: palette.accent,
    fontSize: type.body
  },
  centerPanel: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm
  },
  actionText: {
    color: palette.accent,
    fontSize: type.bodyLarge,
    fontWeight: "800"
  }
});
