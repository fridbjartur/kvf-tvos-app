import strings from "@/constants/strings.json";
/**
 * Program detail screen.
 *
 * Layout:
 *   • Fixed-height banner image at top (fades into dark background via gradient)
 *   • Scrollable content below: title, description, play button, episode row
 *
 * No full-screen backdrop — just banner + dark bg.
 * Episode cards have Animated.spring scale on focus.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { FocusableButton } from "@/components/FocusableButton";
import { FocusScaleCard } from "@/components/focus-scale-card";
import { RefreshIndicator } from "@/components/refresh-indicator";
import { ShimmerBlock } from "@/components/shimmer-block";
import { buildPlayQueue, usePlayQueue } from "@/contexts/PlayQueueContext";
import { loadEpisode, prefetchEpisode, programResource } from "@/services/kvfApi";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useKvfResource } from "@/hooks/useKvfResource";
import { isSectionId } from "@/constants/sections";
import type { Episode, ProgramPage } from "@/types/kvf";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { DESIGN } from "@/constants/app";

const IS_TV = Platform.isTV;
const { height: SCREEN_H } = Dimensions.get("window");
const BANNER_H = IS_TV ? Math.round(SCREEN_H * 0.58) : Math.round(SCREEN_H * 0.42);
const EPISODE_CARD_W = IS_TV ? 320 : 200;

/** Enough placeholder cards to fill the row on a TV without overflowing phones. */
const SKELETON_EPISODES = IS_TV ? [0, 1, 2, 3, 4] : [0, 1, 2];

// ── Animated episode card ──────────────────────────────────────────────────────

interface EpisodeCardProps {
  episode: Episode;
  isActive: boolean;
  onPress: (episode: Episode) => void;
  onFocus: (episode: Episode) => void;
  hasTVPreferredFocus?: boolean;
}

/**
 * The program screen's shape, shown while a cold page is still being fetched.
 *
 * It reuses the real screen's styles rather than approximating them, so when the
 * data lands the banner, title and episode row are already in their final
 * positions and nothing jumps. The back button is real and focusable — a long
 * fetch must never be a dead end the user cannot escape.
 */
function ProgramSkeleton({ title, thumbnailUrl, onBack }: { title?: string; thumbnailUrl?: string; onBack: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.bannerContainer} pointerEvents="none">
        {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.bannerImage} contentFit="cover" transition={300} cachePolicy="memory-disk" /> : <ShimmerBlock style={styles.bannerImage} />}
        <LinearGradient colors={["transparent", "rgba(10,10,10,0.7)", "#0a0a0a"]} locations={[0.3, 0.7, 1]} style={styles.bannerGradient} />
        <LinearGradient colors={["rgba(10,10,10,0.4)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </View>

      <View style={styles.scroll}>
        <View style={styles.bannerSpacer} />

        <View style={styles.info}>
          {title ? <Text style={styles.programTitle}>{title}</Text> : <ShimmerBlock style={styles.skelTitle} />}
          <View style={styles.skelDescription} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ShimmerBlock style={styles.skelLine} delayMs={80} />
            <ShimmerBlock style={[styles.skelLine, styles.skelLineShort]} delayMs={160} />
          </View>

          <View style={styles.actions}>
            <FocusableButton title={strings.program.goBack} onPress={onBack} variant="secondary" hasTVPreferredFocus />
          </View>
        </View>

        <View style={styles.episodesSection}>
          <View style={styles.episodesHeadingRow}>
            <Text style={styles.episodesHeading}>{strings.program.episodesHeading}</Text>
            <RefreshIndicator active variant="inline" label={strings.program.loadingButton} />
          </View>
          <View style={[styles.epSkeletonRow, styles.episodesRow]}>
            {SKELETON_EPISODES.map((i) => (
              <View key={i} style={styles.epOuter}>
                <ShimmerBlock style={styles.epCard} delayMs={i * 120} />
                <ShimmerBlock style={styles.epSkeletonTitle} delayMs={i * 120} />
                <ShimmerBlock style={styles.epSkeletonDate} delayMs={i * 120} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Placeholder cards shown at the head of the episode row while a refresh runs.
 *
 * Rendered as the list's *header* rather than as list data: that leaves every
 * real episode's identity and focus untouched, so the row cannot steal or drop
 * tvOS focus while the placeholders come and go.
 */
function EpisodeSkeletons() {
  return (
    <View style={styles.epSkeletonRow} pointerEvents="none">
      {[0, 1].map((i) => (
        <View key={i} style={styles.epOuter}>
          <ShimmerBlock style={styles.epCard} delayMs={i * 180} />
          <ShimmerBlock style={styles.epSkeletonTitle} delayMs={i * 180} />
          <ShimmerBlock style={styles.epSkeletonDate} delayMs={i * 180} />
        </View>
      ))}
    </View>
  );
}

function EpisodeCard({ episode, isActive, onPress, onFocus, hasTVPreferredFocus }: EpisodeCardProps) {
  const handleFocus = useCallback(() => onFocus(episode), [onFocus, episode]);
  const handlePress = useCallback(() => onPress(episode), [onPress, episode]);

  return (
    <FocusScaleCard
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      activeOpacity={0.9}
      scaleTo={1.08}
      restBorderOpacity={isActive ? 0.5 : 0}
      style={styles.epOuter}
      cardStyle={styles.epCard}
      borderStyle={styles.epBorder}
      accessibilityLabel={episode.title}
      footer={
        <>
          <Text style={styles.epTitle} numberOfLines={2}>
            {episode.title}
          </Text>
          {episode.publishDate ? <Text style={styles.epDate}>{episode.publishDate}</Text> : null}
        </>
      }>
      {episode.thumbnailUrl ? (
        <Image source={{ uri: episode.thumbnailUrl, cacheKey: `ep-${episode.sid}` }} style={styles.epImage} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      ) : (
        <View style={styles.epImagePlaceholder} />
      )}

      {isActive && (
        <View style={styles.nowPlayingBadge}>
          <Text style={styles.nowPlayingText}>▶</Text>
        </View>
      )}
    </FocusScaleCard>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  // `title` and `thumb` are carried over from the card that was pressed, so the
  // skeleton can show the real programme rather than a placeholder for it.
  const { section, slug, title: navTitle, thumb: navThumb } = useLocalSearchParams<{ section: string; slug: string; title?: string; thumb?: string }>();
  const router = useRouter();
  const { setQueue } = usePlayQueue();

  // Only the user's choice is state; the episode itself is derived, so a
  // background refresh can swap the list without clobbering the selection.
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Router params are strings; anything we don't recognise falls back to the
  // main TV section rather than being fetched as a bogus path.
  const safeSection = isSectionId(section) ? section : "sjon";

  const resource = useMemo(() => (slug ? programResource(safeSection, slug) : null), [safeSection, slug]);
  const { data: programPage, isLoading, isRefreshing, error: loadError } = useKvfResource<ProgramPage>(resource, strings.program.failedToLoad);
  const error = playbackError ?? loadError;

  // New episodes land at the head of the list, so the placeholders go there —
  // the row visibly reserves the space that a refresh may be about to fill.
  const showEpisodeSkeletons = useDelayedFlag(isRefreshing);

  // Prefer whatever the user last focused; fall back to the program's current
  // episode. Derived, so a refreshed episode list never resets the selection.
  const focusedEpisode = useMemo<Episode | null>(() => {
    if (!programPage) return null;
    const { episodes, currentEpisodeSid } = programPage;
    const chosen = selectedSid ? episodes.find((e) => e.sid === selectedSid) : undefined;
    if (chosen) return chosen;
    return (currentEpisodeSid ? episodes.find((e) => e.sid === currentEpisodeSid) : undefined) ?? episodes[0] ?? null;
  }, [programPage, selectedSid]);

  const handleEpisodeFocus = useCallback((episode: Episode) => setSelectedSid(episode.sid), []);

  // Prefetch focused episode in background
  useEffect(() => {
    if (!focusedEpisode || !slug) return;
    prefetchEpisode(safeSection, slug, focusedEpisode.sid);
  }, [focusedEpisode, safeSection, slug]);

  const handleEpisodePress = useCallback(
    async (episode: Episode) => {
      if (!programPage || !slug) return;
      setIsResolvingStream(true);
      setPlaybackError(null);

      const { queue, startIndex } = buildPlayQueue(programPage.episodes, safeSection, episode.sid);
      setQueue(queue, startIndex);

      try {
        const detail = await loadEpisode(safeSection, slug, episode.sid);
        if (!detail.streamUrl) {
          setPlaybackError(strings.program.errorNoStream);
          return;
        }
        router.push({
          pathname: "/player",
          params: {
            streamUrl: detail.streamUrl,
            title: episode.title,
            section: safeSection,
            programSlug: slug,
            episodeSid: episode.sid,
          },
        });
      } catch {
        setPlaybackError(strings.program.errorLoadEpisode);
      } finally {
        setIsResolvingStream(false);
      }
    },
    [programPage, safeSection, slug, setQueue, router],
  );

  const handlePlayCurrentPress = useCallback(() => {
    if (!programPage) return;
    const ep = programPage.episodes.find((e) => e.sid === programPage.currentEpisodeSid) ?? programPage.episodes[0];
    if (ep) handleEpisodePress(ep);
  }, [programPage, handleEpisodePress]);

  const handleBack = useCallback(() => router.back(), [router]);

  useScreenBack(handleBack);

  const activeEpSid = programPage?.currentEpisodeSid ?? programPage?.episodes[0]?.sid ?? null;

  const renderEpisode = useCallback(
    ({ item, index }: { item: Episode; index: number }) => (
      <EpisodeCard
        episode={item}
        isActive={item.sid === activeEpSid}
        onPress={handleEpisodePress}
        onFocus={handleEpisodeFocus}
        hasTVPreferredFocus={item.sid === activeEpSid || (index === 0 && !activeEpSid)}
      />
    ),
    [activeEpSid, handleEpisodePress, handleEpisodeFocus],
  );

  // A cold program page can take the better part of a minute — the server
  // scrapes the episode listing page by page. Show the real shape of the screen,
  // with whatever the card we navigated from already told us, rather than a
  // black rectangle: the title and banner below are the true ones.
  if (isLoading && !programPage) {
    return <ProgramSkeleton title={navTitle} thumbnailUrl={navThumb} onBack={handleBack} />;
  }

  if (error && !programPage) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <FocusableButton title={strings.program.goBack} onPress={handleBack} variant="secondary" hasTVPreferredFocus />
      </View>
    );
  }

  const program = programPage?.program;
  const episodes = programPage?.episodes ?? [];

  return (
    <View style={styles.container}>
      {/* Banner: fixed-height image + gradient fade at bottom */}
      <View style={styles.bannerContainer} pointerEvents="none">
        {program?.thumbnailUrl ? (
          <Image source={{ uri: program.thumbnailUrl, cacheKey: `prog-banner-${program.slug}` }} style={styles.bannerImage} contentFit="cover" transition={300} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        {/* Bottom gradient: banner fades to background */}
        <LinearGradient colors={["transparent", "rgba(10,10,10,0.7)", "#0a0a0a"]} locations={[0.3, 0.7, 1]} style={styles.bannerGradient} />
        {/* Left side vignette */}
        <LinearGradient colors={["rgba(10,10,10,0.4)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* Scrollable content overlapping the banner from below */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Spacer: pushes content below the opaque portion of the banner */}
        <View style={styles.bannerSpacer} />

        {/* Program info */}
        <View style={styles.info}>
          <Text style={styles.programTitle}>{program?.title ?? ""}</Text>
          {program?.description ? (
            <Text style={styles.programDescription} numberOfLines={IS_TV ? 3 : 4}>
              {program.description}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {/* Deliberately only swaps the label: FocusableButton's `isLoading`
                disables the button, and a disabled button drops the tvOS focus
                it was holding — mid-press, which is the worst possible moment. */}
            <FocusableButton
              title={isResolvingStream ? strings.program.loadingButton : strings.program.playButton}
              iconName="play"
              onPress={handlePlayCurrentPress}
              variant="primary"
              hasTVPreferredFocus={false}
            />
          </View>
        </View>

        {/* Episodes */}
        {episodes.length > 0 && (
          <View style={styles.episodesSection}>
            <View style={styles.episodesHeadingRow}>
              <Text style={styles.episodesHeading}>{strings.program.episodesHeading}</Text>
              <RefreshIndicator active={isRefreshing} variant="inline" />
            </View>
            <FlatList
              data={episodes}
              renderItem={renderEpisode}
              keyExtractor={(e) => e.listKey}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.episodesRow}
              removeClippedSubviews={false}
              initialNumToRender={8}
              // A long-running series can return ~1000 episodes. Without a
              // budget FlatList keeps mounting batches to fill the default
              // 21-viewport window, and nothing ever unmounts because
              // removeClippedSubviews stays off for tvOS focus. Render far
              // enough ahead that focus never outruns the list, no further.
              windowSize={7}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={50}
              ListHeaderComponent={showEpisodeSkeletons ? EpisodeSkeletons : null}
            />
          </View>
        )}

        {/* Focused episode preview */}
        {focusedEpisode && (
          <BlurView intensity={40} tint="dark" style={styles.epInfo}>
            <Text style={styles.epInfoTitle} numberOfLines={2}>
              {focusedEpisode.title}
            </Text>
            {focusedEpisode.publishDate ? <Text style={styles.epInfoDate}>{focusedEpisode.publishDate}</Text> : null}
          </BlurView>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, backgroundColor: "#0a0a0a" },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? 20 : 15, textAlign: "center", padding: 32 },

  // Banner
  bannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_H,
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerPlaceholder: { width: "100%", height: "100%", backgroundColor: "#1a1a1a" },
  bannerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_H * 0.65,
  },

  // Scrollable content
  scroll: { flex: 1 },
  scrollContent: {},
  bannerSpacer: { height: BANNER_H - (IS_TV ? 180 : 100) },
  info: {
    paddingHorizontal: IS_TV ? 80 : 24,
    paddingBottom: IS_TV ? 24 : 20,
    maxWidth: IS_TV ? 820 : undefined,
  },
  programTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 48 : 26,
    lineHeight: IS_TV ? 56 : 32,
    fontWeight: "800",
    marginBottom: IS_TV ? 12 : 8,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  programDescription: {
    color: "rgba(255,255,255,0.78)",
    fontSize: IS_TV ? 18 : 13,
    lineHeight: IS_TV ? 27 : 19,
    marginBottom: IS_TV ? 20 : 16,
    maxWidth: IS_TV ? 700 : undefined,
  },
  actions: { flexDirection: "row", gap: IS_TV ? 20 : 12 },

  // Episodes
  episodesSection: { marginBottom: IS_TV ? 24 : 14 },
  episodesHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 12 : 10,
    paddingHorizontal: IS_TV ? 80 : 24,
  },
  episodesHeading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 24 : 16,
    fontWeight: "700",
    lineHeight: IS_TV ? 32 : 24,
    letterSpacing: -0.2,
  },
  episodesRow: { paddingHorizontal: IS_TV ? 64 : 12 },

  // Episode placeholders — mirror epOuter/epCard metrics so the real cards do
  // not shift horizontally when the placeholders are swapped out for content.
  epSkeletonRow: { flexDirection: "row" },
  skelTitle: {
    width: "78%",
    height: IS_TV ? 56 : 32,
    borderRadius: 6,
    marginBottom: IS_TV ? 12 : 8,
  },
  skelDescription: { gap: IS_TV ? 9 : 7, marginBottom: IS_TV ? 20 : 16, paddingVertical: IS_TV ? 4 : 3 },
  skelLine: {
    width: "90%",
    height: IS_TV ? 18 : 12,
    borderRadius: 4,
  },
  skelLineShort: { width: "62%" },
  epSkeletonTitle: {
    width: "70%",
    height: IS_TV ? 16 : 11,
    borderRadius: 4,
    marginBottom: 6,
  },
  epSkeletonDate: {
    width: "40%",
    height: IS_TV ? 14 : 10,
    borderRadius: 4,
  },

  // Episode card
  epOuter: {
    width: EPISODE_CARD_W + (IS_TV ? 32 : 20),
    paddingHorizontal: IS_TV ? 16 : 10,
    paddingVertical: IS_TV ? 18 : 12,
  },
  epCard: {
    width: EPISODE_CARD_W,
    aspectRatio: 16 / 9,
    backgroundColor: "#2C2C2E",
    marginBottom: IS_TV ? 14 : 6,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    overflow: "hidden",
  },
  epImage: { width: "100%", height: "100%" },
  epImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#2C2C2E" },
  nowPlayingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nowPlayingText: { color: "#000", fontSize: IS_TV ? 13 : 10, fontWeight: "700" },
  epBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
  },
  epTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 16 : 11,
    fontWeight: "600",
    lineHeight: IS_TV ? 22 : 15,
  },
  epDate: { color: "#98989D", fontSize: IS_TV ? 14 : 10, marginTop: 2 },

  // Focused episode info bar
  epInfo: {
    marginHorizontal: IS_TV ? 80 : 24,
    marginTop: IS_TV ? 4 : 2,
    padding: IS_TV ? 16 : 10,
    overflow: "hidden",
  },
  epInfoTitle: { color: "#FFFFFF", fontSize: IS_TV ? 20 : 14, fontWeight: "600" },
  epInfoDate: { color: "#98989D", fontSize: IS_TV ? 15 : 11, marginTop: 4 },

  bottomPad: { height: IS_TV ? 240 : 80 },
});
