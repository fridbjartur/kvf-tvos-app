import { VideoGridItem } from "@/components/video-grid-item";
import { GRID } from "@/constants/app";
import { useLoading } from "@/contexts/LoadingContext";
import { fetchItemsByIds } from "@/services/jellyfinApi";
import { getRecentProgress } from "@/services/watchProgressService";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Uniform card sizing constants (fixed portrait cards, GRID.CARD_ASPECT_RATIO) — mirrors the Library grid.
const IS_TV = Platform.isTV;
const NUM_COLUMNS = IS_TV ? 5 : 3;
const CARD_PADDING = IS_TV ? 16 : 8;
const GRID_PADDING_H = (IS_TV ? 80 : 60) + (IS_TV ? 40 : 20);
const COLUMN_WRAPPER_PADDING_V = 24;

// TV tab bar is ~210px tall, phone tab bars are ~49px + safe area
const TAB_BAR_HEIGHT = IS_TV ? 210 : 49;

const itemDimensions = (() => {
  const screenWidth = Dimensions.get("window").width;
  const availableWidth = screenWidth - GRID_PADDING_H;
  const columnWidth = availableWidth / NUM_COLUMNS;
  const imageWidth = columnWidth - 2 * CARD_PADDING;
  const imageHeight = imageWidth / GRID.CARD_ASPECT_RATIO; // height = width / (w:h)
  const rowHeight = imageHeight + 2 * CARD_PADDING + 2 * COLUMN_WRAPPER_PADDING_V;
  return { rowHeight };
})();

interface ResumeItem {
  video: JellyfinVideoItem;
  progressPercent: number; // 0–1
}

export default function ContinueWatchingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showGlobalLoader } = useLoading();
  const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reload every time the tab is focused — progress changes after each playback.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const progress = await getRecentProgress();

          if (progress.length === 0) {
            if (!cancelled) {
              setResumeItems([]);
              setIsLoading(false);
            }
            return;
          }

          const ids = progress.map((entry) => entry.videoId);
          const items = await fetchItemsByIds(ids);

          // Map each hydrated item back to its progress fraction (most-recent order preserved).
          const percentById = new Map(progress.map((entry) => [entry.videoId, entry.duration > 0 ? entry.position / entry.duration : 0]));

          const merged: ResumeItem[] = items.map((video) => ({
            video,
            progressPercent: percentById.get(video.Id) ?? 0,
          }));

          if (!cancelled) {
            setResumeItems(merged);
            setIsLoading(false);
          }
        } catch (err) {
          logger.warn("Failed to load continue watching", err, { service: "ContinueWatching" });
          if (!cancelled) {
            setResumeItems([]);
            setIsLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleItemPress = useCallback(
    (video: JellyfinVideoItem) => {
      // Resume is wired in the player via saved progress → StartTimeTicks. Play standalone.
      showGlobalLoader();
      router.push({
        pathname: "/player" as const,
        params: { videoId: video.Id, videoName: video.Name },
      });
    },
    [showGlobalLoader, router],
  );

  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), []);

  const gridContentStyle = useMemo(
    () => ({
      ...styles.gridContent,
      paddingTop: (Platform.isTV ? 20 : 10) + insets.top + 80,
      paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
    }),
    [insets.top, insets.bottom],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<ResumeItem> | null | undefined, index: number) => ({
      length: itemDimensions.rowHeight,
      offset: itemDimensions.rowHeight * Math.floor(index / numColumns),
      index,
    }),
    [numColumns],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ResumeItem; index: number }) => (
      <VideoGridItem video={item.video} onPress={handleItemPress} index={index} hasTVPreferredFocus={index === 0} progressPercent={item.progressPercent} />
    ),
    [handleItemPress],
  );

  return (
    <View style={styles.container}>
      {resumeItems.length === 0 ? (
        <View style={styles.centerContainer}>
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#FFC312" />
              <Text style={styles.loadingText}>Loading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="time-outline" size={64} color="#98989D" />
              <Text style={styles.emptyText}>Nothing in progress yet</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          testID="continue-watching-list"
          data={resumeItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.video.Id}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={gridContentStyle}
          columnWrapperStyle={styles.columnWrapper}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={true}
          updateCellsBatchingPeriod={50}
          initialNumToRender={Platform.isTV ? 15 : 12}
          maxToRenderPerBatch={Platform.isTV ? 15 : 12}
          windowSize={5}
          contentInsetAdjustmentBehavior="never"
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  gridContent: {
    paddingLeft: Platform.isTV ? 80 : 60,
    paddingRight: Platform.isTV ? 40 : 20,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    paddingLeft: Platform.isTV ? 80 : 60,
  },
  loadingText: {
    marginTop: 36,
    fontSize: 20,
    color: "#98989D",
    fontWeight: "500",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 20,
    color: "#98989D",
    textAlign: "center",
  },
});
