import { VideoGridItem } from "@/components/video-grid-item";
import { useLoading } from "@/contexts/LoadingContext";
import { fetchItemsByIds } from "@/services/jellyfinApi";
import { getRecentProgress } from "@/services/watchProgressService";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, FlatList, Platform, StyleSheet, Text, View } from "react-native";

// Mirror the Library grid sizing so shelf cards match a grid column.
const IS_TV = Platform.isTV;
const NUM_COLUMNS = IS_TV ? 5 : 3;
const GRID_PADDING_H = (IS_TV ? 80 : 60) + (IS_TV ? 40 : 20);
const CARD_PADDING = IS_TV ? 16 : 8;

const CARD_WIDTH = (Dimensions.get("window").width - GRID_PADDING_H) / NUM_COLUMNS;

interface ResumeItem {
  video: JellyfinVideoItem;
  progressPercent: number; // 0–1
}

/**
 * Horizontal "Continue Watching" shelf shown at the top of the Library root.
 * Self-contained: loads in-progress items on focus and renders nothing when empty.
 */
export function ContinueWatchingRow() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const [items, setItems] = useState<ResumeItem[]>([]);

  // Reload each time the Library tab regains focus (e.g. after returning from the player).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const progress = await getRecentProgress();
          if (progress.length === 0) {
            if (!cancelled) setItems([]);
            return;
          }

          const ids = progress.map((entry) => entry.videoId);
          const hydrated = await fetchItemsByIds(ids);
          const percentById = new Map(progress.map((entry) => [entry.videoId, entry.duration > 0 ? entry.position / entry.duration : 0]));

          const merged: ResumeItem[] = hydrated.map((video) => ({
            video,
            progressPercent: percentById.get(video.Id) ?? 0,
          }));

          if (!cancelled) setItems(merged);
        } catch (err) {
          logger.warn("Failed to load continue watching row", err, { service: "ContinueWatching" });
          if (!cancelled) setItems([]);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handlePress = useCallback(
    (video: JellyfinVideoItem) => {
      // Player resumes from saved progress (StartTimeTicks). Play standalone.
      showGlobalLoader();
      router.push({
        pathname: "/player" as const,
        params: { videoId: video.Id, videoName: video.Name },
      });
    },
    [showGlobalLoader, router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ResumeItem; index: number }) => <VideoGridItem video={item.video} onPress={handlePress} index={index} cardWidth={CARD_WIDTH} progressPercent={item.progressPercent} />,
    [handlePress],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Continue Watching</Text>
      <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item.video.Id} horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: IS_TV ? 24 : 16,
  },
  heading: {
    marginLeft: CARD_PADDING,
    marginBottom: IS_TV ? 12 : 8,
    fontSize: IS_TV ? 28 : 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
