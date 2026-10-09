import { tvSize } from "@/utils/tvLayout";
import { tvRowScrollProps, tvSnap } from "@/utils/tvScroll";
/**
 * Halt fram at hyggja — the home screen's Continue Watching row.
 *
 * One card per program, most recently watched first. Drawn entirely from the
 * local watch history, so it paints on the first frame with no request. Select
 * resumes playback straight away, as on Netflix and Disney+; holding Select
 * opens the program page instead.
 *
 * Resuming needs the episode's stream URL (cached for hours by kvfApi) and, for
 * Up Next, the program's episode list, which is read from the catalog cache
 * only. If the stream cannot be resolved, the program page opens instead, where
 * the episode is preselected and the error and Retry are shown.
 */

import { EpisodeProgressOverlay, formatMinutesLeft } from "@/components/episodeProgressOverlay";
import { FocusScaleCard } from "@/components/focus-scale-card";
import { DESIGN } from "@/constants/app";
import strings from "@/constants/strings.json";
import { useLoading } from "@/contexts/LoadingContext";
import { buildPlayQueue, usePlayQueue } from "@/contexts/PlayQueueContext";
import { useContinueWatching, useEpisodeProgress } from "@/hooks/useWatchHistory";
import { loadEpisode, peekProgram } from "@/services/kvfApi";
import { isInProgress, programKey, type ContinueWatchingEntry } from "@/services/watchProgressService";
import { logger } from "@/utils/logger";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useRef } from "react";
import { AppState, FlatList, Platform, StyleSheet, Text, TVFocusGuideView, View } from "react-native";

const IS_TV = Platform.isTV;
const CARD_W = IS_TV ? tvSize(360) : 220;

function isForeground(): boolean {
  return AppState.currentState === null || AppState.currentState === "active";
}

interface CardProps {
  entry: ContinueWatchingEntry;
  index: number;
  onPress: (entry: ContinueWatchingEntry) => void;
  onLongPress: (entry: ContinueWatchingEntry) => void;
}

const ContinueWatchingCard = memo(function ContinueWatchingCard({ entry, index, onPress, onLongPress }: CardProps) {
  const progress = useEpisodeProgress(entry.section, entry.slug, entry.sid);
  const handlePress = useCallback(() => onPress(entry), [onPress, entry]);
  const handleLongPress = useCallback(() => onLongPress(entry), [onLongPress, entry]);

  // A card moved on to the next episode has nothing watched yet; say so.
  const detail = isInProgress(progress) ? formatMinutesLeft(progress) : strings.player.upNextHeading;
  const title = entry.programTitle || entry.episodeTitle;

  return (
    <FocusScaleCard
      onPress={handlePress}
      onLongPress={handleLongPress}
      scaleTo={1.05}
      style={S.outer}
      cardStyle={S.card}
      borderStyle={S.border}
      accessibilityLabel={[title, entry.episodeTitle !== title ? entry.episodeTitle : null, detail].filter(Boolean).join(", ")}
      footer={
        <>
          <Text style={S.title} numberOfLines={1}>
            {title}
          </Text>
          {entry.episodeTitle && entry.episodeTitle !== title ? (
            <Text style={S.episode} numberOfLines={1}>
              {entry.episodeTitle}
            </Text>
          ) : null}
          {detail ? <Text style={S.detail}>{detail}</Text> : null}
        </>
      }>
      {entry.thumbnailUrl ? (
        <Image
          source={{ uri: entry.thumbnailUrl }}
          recyclingKey={entry.thumbnailUrl}
          style={S.image}
          contentFit="cover"
          transition={0}
          priority={index < 6 ? "high" : "normal"}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={S.placeholder}>
          <Text style={S.placeholderText} numberOfLines={2}>
            {title}
          </Text>
        </View>
      )}
      <EpisodeProgressOverlay progress={progress?.completed ? undefined : progress} />
    </FocusScaleCard>
  );
});

export function ContinueWatchingRow() {
  const entries = useContinueWatching();
  const router = useRouter();
  const { setQueue, clear } = usePlayQueue();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();

  // Same guard as the program screen: one lookup at a time, and a lookup that
  // finishes after the screen lost focus (or the TV slept) must not navigate.
  const actionRef = useRef({ active: true, busy: false });
  useFocusEffect(
    useCallback(() => {
      const action = { active: true, busy: false };
      actionRef.current = action;
      return () => {
        action.active = false;
      };
    }, []),
  );

  const openProgram = useCallback(
    (entry: ContinueWatchingEntry) => {
      router.push({ pathname: "/program", params: { section: entry.section, slug: entry.slug, title: entry.programTitle, thumb: entry.thumbnailUrl ?? undefined } });
    },
    [router],
  );

  const handleLongPress = useCallback(
    (entry: ContinueWatchingEntry) => {
      const action = actionRef.current;
      if (!action.active || action.busy) return;
      openProgram(entry);
    },
    [openProgram],
  );

  const handlePress = useCallback(
    async (entry: ContinueWatchingEntry) => {
      const action = actionRef.current;
      if (!action.active || action.busy) return;
      action.busy = true;
      showGlobalLoader();
      let opened = false;

      try {
        const [detail, page] = await Promise.all([loadEpisode(entry.section, entry.slug, entry.sid), peekProgram(entry.section, entry.slug)]);
        if (!action.active || !isForeground()) return;

        if (!detail.streamUrl) {
          openProgram(entry);
          return;
        }

        if (page?.episodes.some((episode) => episode.sid === entry.sid)) {
          const { queue, startIndex } = buildPlayQueue(page.episodes, entry.section, entry.sid);
          setQueue(queue, startIndex);
        } else {
          clear();
        }

        action.active = false;
        opened = true;
        router.push({
          pathname: "/player",
          params: {
            streamUrl: detail.streamUrl,
            title: entry.episodeTitle,
            section: entry.section,
            programSlug: entry.slug,
            episodeSid: entry.sid,
            programTitle: entry.programTitle,
            thumb: entry.thumbnailUrl ?? undefined,
            programThumb: page?.program.thumbnailUrl ?? undefined,
          },
        });
      } catch (err) {
        logger.warn("ContinueWatchingRow: failed to resume", { section: entry.section, slug: entry.slug, sid: entry.sid, err });
        if (action.active && isForeground()) openProgram(entry);
      } finally {
        action.busy = false;
        // On success the player hides the loader once it has mounted.
        if (!opened) hideGlobalLoader();
      }
    },
    [showGlobalLoader, hideGlobalLoader, openProgram, setQueue, clear, router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ContinueWatchingEntry; index: number }) => <ContinueWatchingCard entry={item} index={index} onPress={handlePress} onLongPress={handleLongPress} />,
    [handlePress, handleLongPress],
  );

  if (entries.length === 0) return null;

  return (
    <TVFocusGuideView autoFocus {...tvSnap()} trapFocusLeft={Platform.OS === "android"} trapFocusRight={Platform.OS === "android"}>
      <Text style={S.heading}>{strings.watch_progress.continue_watching_heading}</Text>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(entry) => programKey(entry.section, entry.slug)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.rowContent}
        style={S.rowList}
        removeClippedSubviews={false}
        initialNumToRender={6}
        {...tvRowScrollProps()}
      />
    </TVFocusGuideView>
  );
}

// Named "S" (not "styles") to prevent editor auto-import from shadowing this with an external module.
const S = StyleSheet.create({
  // Matches the category rows in section-screen so the shelves line up.
  heading: { color: "#FFFFFF", fontSize: IS_TV ? tvSize(30) : 16, fontWeight: "600", marginBottom: 2, marginLeft: IS_TV ? tvSize(76) : 20, letterSpacing: -0.2 },
  rowList: { overflow: "visible" },
  rowContent: { paddingHorizontal: IS_TV ? tvSize(60) : 12 },
  outer: {
    width: CARD_W + (IS_TV ? tvSize(32) : 20),
    paddingHorizontal: IS_TV ? tvSize(16) : 10,
    paddingVertical: IS_TV ? tvSize(18) : 12,
  },
  card: {
    width: CARD_W,
    aspectRatio: 16 / 9,
    marginBottom: IS_TV ? tvSize(14) : 6,
    overflow: "hidden",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    backgroundColor: "#1C1C1E",
  },
  image: { width: "100%", height: "100%" },
  placeholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", padding: 16 },
  placeholderText: { color: "#636366", fontSize: IS_TV ? tvSize(18) : 13, fontWeight: "600", textAlign: "center" },
  border: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? tvSize(3) : 2,
    borderColor: "#FFFFFF",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
  },
  title: { color: "#FFFFFF", fontSize: IS_TV ? tvSize(19) : 12, fontWeight: "700", lineHeight: IS_TV ? tvSize(24) : 16 },
  episode: { color: "rgba(255,255,255,0.75)", fontSize: IS_TV ? tvSize(16) : 11, lineHeight: IS_TV ? tvSize(22) : 15, marginTop: 2 },
  detail: { color: "#98989D", fontSize: IS_TV ? tvSize(14) : 10, marginTop: 2 },
});
