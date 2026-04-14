import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useEpisodeDetail } from "../hooks/useEpisodeDetail";
import type { RootStackParamList } from "../navigation/types";
import { palette, spacing, type } from "../theme";
import { getPlaybackLoadErrorTitle, getRetryLabel } from "../utils/content";

type Props = NativeStackScreenProps<RootStackParamList, "Playback">;

export function PlaybackScreen({ navigation, route }: Props) {
  const { section, slug, sid } = route.params;
  const { data, error, isLoading, reload } = useEpisodeDetail(
    section,
    slug,
    sid,
  );
  const videoRef = useRef<VideoView>(null);
  const player = useVideoPlayer(data?.streamUrl ?? "", (instance) => {
    if (data?.streamUrl) {
      instance.play();
    }
  });

  useEffect(() => {
    if (!data?.playbackAvailable || !data.streamUrl) return;

    const timer = setTimeout(() => {
      videoRef.current?.enterFullscreen();
      player.play();
    }, 150);

    return () => clearTimeout(timer);
  }, [data?.playbackAvailable, data?.streamUrl, player]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{getPlaybackLoadErrorTitle()}</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Button
          label={getRetryLabel()}
          onPress={reload}
          size="md"
          style={styles.centeredButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <VideoView
        ref={videoRef}
        allowsFullscreen
        contentFit="contain"
        nativeControls
        onFullscreenExit={() => navigation.goBack()}
        player={player}
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: palette.background,
  },
  errorTitle: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
  },
  errorBody: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
  },
  centeredButton: {
    alignSelf: "center",
  },
});
