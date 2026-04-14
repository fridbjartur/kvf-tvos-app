import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
} from "react-native";
import { HeroImage } from "../components/HeroImage";
import { useState } from "react";
import { ContentRail } from "../components/ContentRail";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { Screen } from "../components/Screen";
import { useProgramDetail } from "../hooks/useProgramDetail";
import type { RootStackParamList } from "../navigation/types";
import { palette, radii, spacing, type } from "../theme";
import {
  formatPublishDate,
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
  const primaryEpisode = sid
    ? (data?.episodes.find((ep) => ep.sid === sid) ??
      data?.primaryEpisode ??
      null)
    : (data?.primaryEpisode ?? null);
  const [backNode, setBackNode] = useState<number | undefined>(undefined);
  const [playNode, setPlayNode] = useState<number | undefined>(undefined);
  const [firstEpisodeNode, setFirstEpisodeNode] = useState<number | undefined>(
    undefined,
  );

  return (
    <Screen>
      {isLoading ? <LoadingSkeleton /> : null}
      {!isLoading && error ? (
        <View style={styles.messagePanel}>
          <Text style={styles.eyebrow}>{getSectionLabel(section)}</Text>
          <Text style={styles.title}>{getProgramLoadErrorTitle()}</Text>
          <Text style={styles.body}>{error}</Text>
          <Text onPress={reload} style={styles.retryText}>
            {getRetryLabel()}
          </Text>
        </View>
      ) : null}
      {!isLoading && !error && data ? (
        <View style={styles.container}>
          {/* Hero */}
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
              <Pressable
                hasTVPreferredFocus
                nextFocusDown={firstEpisodeNode}
                nextFocusUp={backNode}
                onPress={() =>
                  navigation.navigate("Playback", {
                    section: data.section,
                    slug: primaryEpisode.slug,
                    sid: primaryEpisode.sid,
                  })
                }
                ref={(node) => setPlayNode(findNodeHandle(node) ?? undefined)}
                style={({ focused }) => [
                  styles.playButton,
                  focused && styles.playButtonFocused,
                ]}
              >
                <Text style={styles.playText}>{getProgramPlayLabel()}</Text>
              </Pressable>
            ) : (
              <View style={styles.unavailable}>
                <Text style={styles.unavailableText}>
                  {getProgramNoEpisodesAvailableLabel()}
                </Text>
              </View>
            )}
          </HeroImage>

          {/* Episodes */}
          {data.episodes.length ? (
            <View style={styles.episodeSection}>
              <ContentRail
                items={data.episodes}
                firstItemRef={(node) =>
                  setFirstEpisodeNode(findNodeHandle(node) ?? undefined)
                }
                nextFocusUp={playNode}
                onSelectEpisode={(episode) =>
                  navigation.setParams({ sid: episode.sid })
                }
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  backButtonFocused: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.5)",
    transform: [{ scale: 1.05 }],
  },
  backText: {
    color: palette.text,
    fontSize: type.body,
    fontWeight: "700",
  },

  // Typography
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

  // Play button
  playButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderColor: "transparent",
  },
  playButtonFocused: {
    backgroundColor: "#e4e4e4",
  },
  playText: {
    color: "#0B0B0B",
    fontSize: type.bodyLarge,
    fontWeight: "900",
  },
  playMeta: {
    color: "rgba(11,11,11,0.55)",
    fontSize: type.body,
    fontWeight: "600",
  },

  // Unavailable state
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

  // Episode section
  episodeSection: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  episodeHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  episodeHeading: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
  },
  episodeCount: {
    color: palette.textMuted,
    fontSize: type.body,
    fontWeight: "600",
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

  // Error state
  messagePanel: {
    minHeight: 480,
    justifyContent: "center",
    gap: spacing.sm,
  },
  retryText: {
    color: palette.accent,
    fontSize: type.bodyLarge,
    fontWeight: "800",
  },
});
