import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { HeroImage } from "../components/HeroImage";
import { ContentRail } from "../components/ContentRail";
import type { RailCard } from "../components/ContentRail";
import {
  FullscreenVideoPlayer,
  type PlaybackRequest,
} from "../components/FullscreenVideoPlayer";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Screen } from "../components/Screen";
import { useProgramDetail } from "../hooks/useProgramDetail";
import type { RootStackParamList } from "../navigation/types";
import { palette, radii, spacing, type } from "../theme";
import {
  formatPublishDate,
  getEpisodeBadgeLabel,
  getEpisodeCountLabel,
  getProgramEpisodesLabel,
  getProgramLoadErrorTitle,
  getProgramNoEpisodesAvailableLabel,
  getProgramNoEpisodesYetLabel,
  getProgramPlayLabel,
  getRetryLabel,
  getSectionLabel,
} from "../utils/content";

type Props = NativeStackScreenProps<RootStackParamList, "ProgramDetail">;

export function ProgramScreen({ navigation, route }: Props) {
  const { section, slug, sid } = route.params;
  const { data, error, isLoading, reload } = useProgramDetail(section, slug);
  const [playback, setPlayback] = useState<PlaybackRequest | null>(null);
  const [resumeTimes, setResumeTimes] = useState<Record<string, number>>({});
  const primaryEpisode = sid
    ? (data?.episodes.find((ep) => ep.sid === sid) ??
      data?.primaryEpisode ??
      null)
    : (data?.primaryEpisode ?? null);

  function handleOpenPlayback() {
    if (!primaryEpisode) return;

    setPlayback({
      kind: "episode",
      section: data?.section ?? section,
      slug: primaryEpisode.slug,
      sid: primaryEpisode.sid,
      initialTime: resumeTimes[primaryEpisode.sid] ?? 0,
    });
  }

  function handleClosePlayback(currentTime?: number) {
    if (playback?.kind === "episode" && typeof currentTime === "number") {
      setResumeTimes((current) => ({
        ...current,
        [playback.sid]: currentTime,
      }));
    }

    setPlayback(null);
  }

  return (
    <View style={styles.screen}>
      <Screen>
        {isLoading ? <LoadingSkeleton /> : null}
        {!isLoading && error ? (
          <View style={styles.messagePanel}>
            <Text style={styles.eyebrow}>{getSectionLabel(section)}</Text>
            <Text style={styles.title}>{getProgramLoadErrorTitle()}</Text>
            <Text style={styles.body}>{error}</Text>
            <Button label={getRetryLabel()} onPress={reload} size="md" />
          </View>
        ) : null}
        {!isLoading && !error && data ? (
          <View style={styles.container}>
            <HeroImage
              dimmer={0.5}
              imageUrl={primaryEpisode?.imageUrl ?? data.imageUrl}
              height={580}
            >
              <Text style={styles.eyebrow}>{data.title}</Text>
              <Text style={styles.heroTitle}>
                {primaryEpisode?.title ?? data.title}
              </Text>
              <Text style={styles.heroBody} numberOfLines={2}>
                {formatPublishDate(primaryEpisode?.publishDate ?? null) ??
                  data.description ??
                  ""}
              </Text>
              {primaryEpisode ? (
                <Button
                  label={getProgramPlayLabel()}
                  onPress={handleOpenPlayback}
                  size="lg"
                  style={styles.playButton}
                  textStyle={styles.playText}
                />
              ) : (
                <View style={styles.unavailable}>
                  <Text style={styles.unavailableText}>
                    {getProgramNoEpisodesAvailableLabel()}
                  </Text>
                </View>
              )}
            </HeroImage>

            {data.episodes.length ? (
              <View style={styles.episodeSection}>
                <ContentRail
                  cards={data.episodes.map(
                    (episode): RailCard => ({
                      id: episode.id,
                      title: episode.title,
                      imageUrl: episode.imageUrl,
                      badge: getEpisodeBadgeLabel(),
                      subtitle:
                        formatPublishDate(episode.publishDate) ?? undefined,
                      onPress: () => navigation.setParams({ sid: episode.sid }),
                    }),
                  )}
                  title={getProgramEpisodesLabel()}
                  sectionLabel={getEpisodeCountLabel(data.episodes.length)}
                />
              </View>
            ) : (
              <View style={styles.emptyEpisodes}>
                <Text style={styles.emptyEpisodesText}>
                  {getProgramNoEpisodesYetLabel()}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </Screen>
      {playback ? (
        <FullscreenVideoPlayer playback={playback} onClose={handleClosePlayback} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  eyebrow: {
    color: palette.text,
    fontSize: type.body,
    textTransform: "uppercase",
    letterSpacing: 2.5,
  },
  heroTitle: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: "900",
    lineHeight: 60,
  },
  heroBody: {
    color: "rgba(255,255,255,0.68)",
    fontSize: type.bodyLarge,
    lineHeight: 32,
  },
  title: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: "900",
  },
  body: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
    lineHeight: 30,
  },
  playButton: {
    marginTop: spacing.xs,
  },
  playText: {
    fontWeight: "900",
  },
  unavailable: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  unavailableText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: type.bodyLarge,
    fontWeight: "600",
  },
  episodeSection: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  emptyEpisodes: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: palette.panel,
  },
  emptyEpisodesText: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
  },
  messagePanel: {
    minHeight: 480,
    justifyContent: "center",
    gap: spacing.sm,
  },
});
