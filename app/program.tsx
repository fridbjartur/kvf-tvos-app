import { tvSize } from "@/utils/tvLayout";
import { tvRowScrollProps, tvScreenScrollProps, tvSnap } from "@/utils/tvScroll";
import strings from "@/constants/strings.json";
/**
 * Program detail screen.
 *
 * Layout:
 *   • Fixed-height banner image at top (fades into dark background via gradient)
 *   • Scrollable content below: title, description, play button, episode row
 *
 * No full-screen backdrop — just banner + dark bg.
 * Episode cards have Animated.spring scale on focus, and show watch progress
 * (a bar while part-watched, a Watched badge once finished).
 *
 * With an episode to continue — the one this program's Continue Watching card
 * points at — that episode is preselected and focus starts on the primary
 * button, as on Netflix and Disney+. The button reads Resume while the episode
 * is part-watched, with Start Over beside it.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { FocusableButton } from "@/components/FocusableButton";
import { FocusScaleCard } from "@/components/focus-scale-card";
import { EpisodeProgressOverlay, formatMinutesLeft } from "@/components/episodeProgressOverlay";
import { RefreshIndicator } from "@/components/refresh-indicator";
import { ShimmerBlock } from "@/components/shimmer-block";
import { buildPlayQueue, usePlayQueue } from "@/contexts/PlayQueueContext";
import { loadEpisode, prefetchEpisode, programResource } from "@/services/kvfApi";
import { isInProgress } from "@/services/watchProgressService";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useKvfResource } from "@/hooks/useKvfResource";
import { useContinueWatchingEntry, useEpisodeProgress } from "@/hooks/useWatchHistory";
import { isSectionId, type SectionId } from "@/constants/sections";
import type { Episode, ProgramPage } from "@/types/kvf";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { DESIGN } from "@/constants/app";

const IS_TV = Platform.isTV;
const { height: SCREEN_H } = Dimensions.get("window");
const BANNER_H = IS_TV ? Math.round(SCREEN_H * 0.58) : Math.round(SCREEN_H * 0.42);
const EPISODE_CARD_W = IS_TV ? tvSize(320) : 200;
/** Space kept below the episode preview when Android TV scrolls it into view. */
const BOTTOM_INSET = tvSize(40);

/** Enough placeholder cards to fill the row on a TV without overflowing phones. */
const SKELETON_EPISODES = IS_TV ? [0, 1, 2, 3, 4] : [0, 1, 2];

// ── Animated episode card ──────────────────────────────────────────────────────

interface EpisodeCardProps {
  episode: Episode;
  section: SectionId;
  programSlug: string;
  isSelected: boolean;
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
            <FocusableButton title={strings.program.goBack} onPress={onBack} hasTVPreferredFocus />
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

function EpisodeCard({ episode, section, programSlug, isSelected, onPress, onFocus, hasTVPreferredFocus }: EpisodeCardProps) {
  // Subscribed per card, so recording one episode re-renders only its own card.
  const progress = useEpisodeProgress(section, programSlug, episode.sid);
  const handleFocus = useCallback(() => onFocus(episode), [onFocus, episode]);
  const handlePress = useCallback(() => onPress(episode), [onPress, episode]);

  return (
    <FocusScaleCard
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      activeOpacity={0.9}
      scaleTo={1.08}
      restBorderOpacity={isSelected ? 0.5 : 0}
      style={styles.epOuter}
      cardStyle={styles.epCard}
      borderStyle={styles.epBorder}
      accessibilityLabel={[episode.title, progress?.completed ? strings.watch_progress.watched_badge : isInProgress(progress) ? formatMinutesLeft(progress) : null].filter(Boolean).join(", ")}
      accessibilityState={{ selected: isSelected }}
      footer={
        <>
          <Text style={styles.epTitle} numberOfLines={2}>
            {episode.title}
          </Text>
          {episode.publishDate ? <Text style={styles.epDate}>{episode.publishDate}</Text> : null}
        </>
      }>
      {episode.thumbnailUrl ? (
        <Image source={{ uri: episode.thumbnailUrl }} recyclingKey={episode.thumbnailUrl} style={styles.epImage} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      ) : (
        <View style={styles.epImagePlaceholder} />
      )}

      {isSelected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>▶</Text>
        </View>
      )}

      <EpisodeProgressOverlay progress={progress} />
    </FocusScaleCard>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  // `title` and `thumb` are carried over from the card that was pressed, so the
  // skeleton can show the real programme rather than a placeholder for it.
  const params = useLocalSearchParams<{ section: string; slug: string; title?: string; thumb?: string }>();
  return <ProgramSession key={`${params.section}:${params.slug}`} params={params} />;
}

function ProgramSession({ params }: { params: { section: string; slug: string; title?: string; thumb?: string } }) {
  const { section, slug, title: navTitle, thumb: navThumb } = params;
  const router = useRouter();
  const { setQueue } = usePlayQueue();

  // Only the user's choice is state; the episode itself is derived, so a
  // background refresh can swap the list without clobbering the selection.
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const actionRef = useRef({ active: true, busy: false });

  useFocusEffect(
    useCallback(() => {
      const action = { active: true, busy: false };
      actionRef.current = action;
      setIsResolvingStream(false);
      setPlaybackError(null);
      return () => {
        action.active = false;
      };
    }, []),
  );

  // Router params are strings; anything we don't recognise falls back to the
  // main TV section rather than being fetched as a bogus path.
  const safeSection = isSectionId(section) ? section : "sjon";

  const resource = useMemo(() => (slug ? programResource(safeSection, slug) : null), [safeSection, slug]);
  const { data: programPage, isLoading, isRefreshing, error: loadError, refresh } = useKvfResource<ProgramPage>(resource, strings.program.failedToLoad);
  const error = playbackError ?? loadError;

  // New episodes land at the head of the list, so the placeholders go there —
  // the row visibly reserves the space that a refresh may be about to fill.
  const showEpisodeSkeletons = useDelayedFlag(isRefreshing);

  // The episode this program's Continue Watching card points at, if the list has it.
  const continueEntry = useContinueWatchingEntry(safeSection, slug);
  const continueSid = useMemo(() => {
    if (!programPage || !continueEntry) return null;
    return programPage.episodes.some((e) => e.sid === continueEntry.sid) ? continueEntry.sid : null;
  }, [programPage, continueEntry]);

  // Prefer whatever the user last focused; then the episode to continue; then
  // the program's current episode. Derived, so a refreshed episode list never
  // resets the selection.
  const selectedEpisode = useMemo<Episode | null>(() => {
    if (!programPage) return null;
    const { episodes, currentEpisodeSid } = programPage;
    const chosen = selectedSid ? episodes.find((e) => e.sid === selectedSid) : undefined;
    if (chosen) return chosen;
    const fallbackSid = continueSid ?? currentEpisodeSid;
    return (fallbackSid ? episodes.find((e) => e.sid === fallbackSid) : undefined) ?? episodes[0] ?? null;
  }, [programPage, selectedSid, continueSid]);

  const selectedProgress = useEpisodeProgress(safeSection, slug, selectedEpisode?.sid);
  const canResume = isInProgress(selectedProgress);
  const minutesLeft = isInProgress(selectedProgress) ? formatMinutesLeft(selectedProgress) : null;

  // The episode to continue may sit far down a long row, beyond what the list
  // has rendered, so focus starts on the primary button instead of its card.
  const focusPrimaryAction = selectedSid === null && (continueSid !== null || (Platform.isTV && Platform.OS === "android"));

  const handleEpisodeFocus = useCallback((episode: Episode) => setSelectedSid(episode.sid), []);

  // Prefetch focused episode in background
  useEffect(() => {
    if (!selectedEpisode || !slug) return;
    prefetchEpisode(safeSection, slug, selectedEpisode.sid);
  }, [selectedEpisode, safeSection, slug]);

  const handleEpisodePress = useCallback(
    async (episode: Episode, fromStart = false) => {
      const action = actionRef.current;
      if (!programPage || !slug || !action.active || action.busy) return;
      action.busy = true;
      setSelectedSid(episode.sid);
      setIsResolvingStream(true);
      setPlaybackError(null);

      const { queue, startIndex } = buildPlayQueue(programPage.episodes, safeSection, episode.sid);
      try {
        const detail = await loadEpisode(safeSection, slug, episode.sid);
        if (!action.active || (AppState.currentState !== null && AppState.currentState !== "active")) return;
        if (!detail.streamUrl) {
          setPlaybackError(strings.program.errorNoStream);
          return;
        }
        setQueue(queue, startIndex);
        action.active = false;
        router.push({
          pathname: "/player",
          params: {
            streamUrl: detail.streamUrl,
            title: episode.title,
            section: safeSection,
            programSlug: slug,
            episodeSid: episode.sid,
            programTitle: programPage.program.title,
            thumb: episode.thumbnailUrl ?? undefined,
            programThumb: programPage.program.thumbnailUrl ?? undefined,
            fromStart: fromStart ? "true" : undefined,
          },
        });
      } catch {
        if (action.active) setPlaybackError(strings.program.errorLoadEpisode);
      } finally {
        action.busy = false;
        if (action.active) setIsResolvingStream(false);
      }
    },
    [programPage, safeSection, slug, setQueue, router],
  );

  const handlePlaySelectedPress = useCallback(() => {
    if (selectedEpisode) handleEpisodePress(selectedEpisode);
  }, [selectedEpisode, handleEpisodePress]);

  const handleRestartSelectedPress = useCallback(() => {
    if (selectedEpisode) handleEpisodePress(selectedEpisode, true);
  }, [selectedEpisode, handleEpisodePress]);

  const handleBack = useCallback(() => {
    actionRef.current.active = false;
    router.back();
  }, [router]);

  useScreenBack(handleBack);

  const selectedEpSid = selectedEpisode?.sid ?? null;

  const renderEpisode = useCallback(
    ({ item }: { item: Episode }) => (
      <EpisodeCard
        episode={item}
        section={safeSection}
        programSlug={slug}
        isSelected={item.sid === selectedEpSid}
        onPress={handleEpisodePress}
        onFocus={handleEpisodeFocus}
        hasTVPreferredFocus={!focusPrimaryAction && selectedSid === null && item.sid === selectedEpSid}
      />
    ),
    [safeSection, slug, selectedEpSid, selectedSid, focusPrimaryAction, handleEpisodePress, handleEpisodeFocus],
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
        <FocusableButton title={strings.player.retryButton} onPress={refresh} />
        <FocusableButton title={strings.program.goBack} onPress={handleBack} hasTVPreferredFocus />
      </View>
    );
  }

  const program = programPage?.program;
  const episodes = programPage?.episodes ?? [];
  const thumbnailUrl = selectedEpisode?.thumbnailUrl ?? program?.thumbnailUrl;

  return (
    <View style={styles.container}>
      {/* Banner: fixed-height image + gradient fade at bottom */}
      <View style={styles.bannerContainer} pointerEvents="none">
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} recyclingKey={thumbnailUrl} style={styles.bannerImage} contentFit="cover" transition={300} cachePolicy="memory-disk" />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        {/* Bottom gradient: banner fades to background */}
        <LinearGradient colors={["transparent", "rgba(10,10,10,0.7)", "#0a0a0a"]} locations={[0.3, 0.7, 1]} style={styles.bannerGradient} />
        {/* Left side vignette */}
        <LinearGradient colors={["rgba(10,10,10,0.4)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* Scrollable content overlapping the banner from below */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} {...tvScreenScrollProps(BOTTOM_INSET)}>
        {/* Spacer: pushes content below the opaque portion of the banner */}
        <View style={styles.bannerSpacer} />

        {/* Program info */}
        <View style={styles.info} {...tvSnap("end")}>
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
              title={isResolvingStream ? strings.program.loadingButton : canResume ? strings.watch_progress.resume_button : strings.program.playButton}
              iconName="play"
              onPress={handlePlaySelectedPress}
              accessibilityLabel={`${canResume ? strings.watch_progress.resume_button : strings.program.playButton}: ${selectedEpisode?.title ?? program?.title ?? ""}`}
              hasTVPreferredFocus={focusPrimaryAction}
            />
            {canResume ? (
              <FocusableButton
                title={strings.watch_progress.restart_button}
                iconName="refresh"
                onPress={handleRestartSelectedPress}
                accessibilityLabel={`${strings.watch_progress.restart_button}: ${selectedEpisode?.title ?? ""}`}
              />
            ) : null}
          </View>
        </View>

        {/* Episodes and the focused episode's preview scroll into view together. */}
        <View {...tvSnap("end")}>
          {episodes.length > 0 && (
            <View style={styles.episodesSection}>
              <View style={styles.episodesHeadingRow}>
                <Text style={styles.episodesHeading}>{strings.program.episodesHeading}</Text>
                <RefreshIndicator active={isRefreshing} variant="inline" />
              </View>
              <FlatList
                data={episodes}
                extraData={selectedEpSid}
                renderItem={renderEpisode}
                keyExtractor={(e) => e.listKey}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.episodesRow}
                removeClippedSubviews={false}
                {...tvRowScrollProps()}
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
          {selectedEpisode && (
            <BlurView intensity={40} tint="dark" style={styles.epInfo}>
              <Text style={styles.epInfoTitle} numberOfLines={2}>
                {selectedEpisode.title}
              </Text>
              {selectedEpisode.publishDate ? <Text style={styles.epInfoDate}>{selectedEpisode.publishDate}</Text> : null}
              {minutesLeft ? <Text style={styles.epInfoDate}>{minutesLeft}</Text> : null}
            </BlurView>
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, backgroundColor: "#0a0a0a" },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? tvSize(20) : 15, textAlign: "center", padding: 32 },

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
  bannerSpacer: { height: BANNER_H - (IS_TV ? tvSize(180) : 100) },
  info: {
    paddingHorizontal: IS_TV ? tvSize(80) : 24,
    paddingBottom: IS_TV ? tvSize(24) : 20,
    maxWidth: IS_TV ? tvSize(820) : undefined,
  },
  programTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? tvSize(48) : 26,
    lineHeight: IS_TV ? tvSize(56) : 32,
    fontWeight: "800",
    marginBottom: IS_TV ? tvSize(12) : 8,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  programDescription: {
    color: "rgba(255,255,255,0.78)",
    fontSize: IS_TV ? tvSize(18) : 13,
    lineHeight: IS_TV ? tvSize(27) : 19,
    marginBottom: IS_TV ? tvSize(20) : 16,
    maxWidth: IS_TV ? tvSize(700) : undefined,
  },
  actions: { flexDirection: "row", gap: IS_TV ? tvSize(20) : 12 },

  // Episodes
  episodesSection: { marginBottom: IS_TV ? tvSize(24) : 14 },
  episodesHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? tvSize(12) : 10,
    paddingHorizontal: IS_TV ? tvSize(80) : 24,
  },
  episodesHeading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? tvSize(24) : 16,
    fontWeight: "700",
    lineHeight: IS_TV ? tvSize(32) : 24,
    letterSpacing: -0.2,
  },
  episodesRow: { paddingHorizontal: IS_TV ? tvSize(64) : 12 },

  // Episode placeholders — mirror epOuter/epCard metrics so the real cards do
  // not shift horizontally when the placeholders are swapped out for content.
  epSkeletonRow: { flexDirection: "row" },
  skelTitle: {
    width: "78%",
    height: IS_TV ? tvSize(56) : 32,
    borderRadius: 6,
    marginBottom: IS_TV ? tvSize(12) : 8,
  },
  skelDescription: { gap: IS_TV ? tvSize(9) : 7, marginBottom: IS_TV ? tvSize(20) : 16, paddingVertical: IS_TV ? tvSize(4) : 3 },
  skelLine: {
    width: "90%",
    height: IS_TV ? tvSize(18) : 12,
    borderRadius: 4,
  },
  skelLineShort: { width: "62%" },
  epSkeletonTitle: {
    width: "70%",
    height: IS_TV ? tvSize(16) : 11,
    borderRadius: 4,
    marginBottom: 6,
  },
  epSkeletonDate: {
    width: "40%",
    height: IS_TV ? tvSize(14) : 10,
    borderRadius: 4,
  },

  // Episode card
  epOuter: {
    width: EPISODE_CARD_W + (IS_TV ? tvSize(32) : 20),
    paddingHorizontal: IS_TV ? tvSize(16) : 10,
    paddingVertical: IS_TV ? tvSize(18) : 12,
  },
  epCard: {
    width: EPISODE_CARD_W,
    aspectRatio: 16 / 9,
    backgroundColor: "#2C2C2E",
    marginBottom: IS_TV ? tvSize(14) : 6,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    overflow: "hidden",
  },
  epImage: { width: "100%", height: "100%" },
  epImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#2C2C2E" },
  selectedBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedBadgeText: { color: "#000", fontSize: IS_TV ? tvSize(13) : 10, fontWeight: "700" },
  epBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? tvSize(3) : 2,
    borderColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
  },
  epTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? tvSize(16) : 11,
    fontWeight: "600",
    lineHeight: IS_TV ? tvSize(22) : 15,
  },
  epDate: { color: "#98989D", fontSize: IS_TV ? tvSize(14) : 10, marginTop: 2 },

  // Focused episode info bar
  epInfo: {
    marginHorizontal: IS_TV ? tvSize(80) : 24,
    marginTop: IS_TV ? tvSize(4) : 2,
    padding: IS_TV ? tvSize(16) : 10,
    overflow: "hidden",
  },
  epInfoTitle: { color: "#FFFFFF", fontSize: IS_TV ? tvSize(20) : 14, fontWeight: "600" },
  epInfoDate: { color: "#98989D", fontSize: IS_TV ? tvSize(15) : 11, marginTop: 4 },

  bottomPad: { height: IS_TV ? tvSize(240) : 80 },
});
