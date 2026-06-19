import { BackGridItem } from "@/components/back-grid-item";
import { Breadcrumb } from "@/components/breadcrumb";
import { FocusableButton } from "@/components/FocusableButton";
import { FolderGridItem } from "@/components/folder-grid-item";
import { VideoGridItem } from "@/components/video-grid-item";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLoading } from "@/contexts/LoadingContext";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { connectToDemoServer, isFolder } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Dimensions, FlatList, Platform, StyleSheet, Text, View, useTVEventHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Special marker for the ".." back navigation item
const BACK_ITEM_ID = "__BACK__";
type GridItem = JellyfinItem | { Id: typeof BACK_ITEM_ID; _isBackItem: true };

// Uniform card sizing constants (all cards are 2:3 portrait)
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
  const imageHeight = imageWidth * 1.5; // 2:3 aspect ratio → height = width * 3/2
  const rowHeight = imageHeight + 2 * CARD_PADDING + 2 * COLUMN_WRAPPER_PADDING_V;
  return { rowHeight };
})();

export default function VideoLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  const { items, isLoading, isLoadingMore, hasMoreResults, error, folderStack, currentFolder, navigateToFolder, navigateBack, loadMore, refresh } = useFolderNavigation();
  const { buildQueue } = usePlayQueue();
  const [isConnectingToDemo, setIsConnectingToDemo] = useState(false);

  // Handle TV menu button for back navigation
  useTVEventHandler((event) => {
    if (event.eventType === "menu" && folderStack.length > 0) {
      navigateBack();
    }
  });

  // Handle Android back button
  useEffect(() => {
    const handleBackPress = () => {
      if (folderStack.length > 0) {
        navigateBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [folderStack, navigateBack]);

  const handleItemPress = useCallback(
    (item: JellyfinItem) => {
      // Debug logging to diagnose playlist item issues
      logger.debug("Item pressed", {
        service: "LibraryScreen",
        itemId: item.Id,
        itemName: item.Name,
        itemType: item.Type,
        isFolder: isFolder(item),
        currentFolder: currentFolder?.name,
        currentFolderType: currentFolder?.type,
      });

      if (isFolder(item)) {
        navigateToFolder({
          id: item.Id,
          name: item.Name,
          parentId: item.ParentId,
          type: item.Type === "Playlist" ? "playlist" : "folder",
        });
      } else if (currentFolder) {
        // Inside a folder — build a queue of all videos under this folder
        const folderType = currentFolder.type === "playlist" ? "playlist" : "folder";
        buildQueue(currentFolder.id, currentFolder.name, item.Id, folderType);
        showGlobalLoader();
        router.push({
          pathname: "/player" as const,
          params: { videoId: item.Id, videoName: item.Name, queueMode: "true" },
        });
      } else {
        // At library root — play standalone (no queue)
        showGlobalLoader();
        router.push({
          pathname: "/player" as const,
          params: { videoId: item.Id, videoName: item.Name },
        });
      }
    },
    [navigateToFolder, showGlobalLoader, router, currentFolder, buildQueue],
  );

  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), []);

  // Dynamic content padding that accounts for tab bar safe area
  const gridContentStyle = useMemo(
    () => ({
      ...styles.gridContent,
      paddingTop: (Platform.isTV ? 20 : 10) + insets.top + 80,
      paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
    }),
    [insets.top, insets.bottom],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<GridItem> | null | undefined, index: number) => ({
      length: itemDimensions.rowHeight,
      offset: itemDimensions.rowHeight * Math.floor(index / numColumns),
      index,
    }),
    [numColumns],
  );

  // Show back item when inside a library (can go back to library selection)
  const showBackItem = folderStack.length > 0;

  // Create grid data with optional back item prepended
  const gridData: GridItem[] = useMemo(() => {
    if (showBackItem) {
      return [{ Id: BACK_ITEM_ID, _isBackItem: true as const }, ...items];
    }
    return items;
  }, [items, showBackItem]);

  const renderItem = useCallback(
    ({ item, index }: { item: GridItem; index: number }) => {
      // Handle back navigation item
      if ("_isBackItem" in item && item._isBackItem) {
        return <BackGridItem onPress={navigateBack} hasTVPreferredFocus={index === 0} isLoading={isLoading} />;
      }

      // Handle regular items
      const jellyfinItem = item as JellyfinItem;
      if (isFolder(jellyfinItem)) {
        return <FolderGridItem folder={jellyfinItem} onPress={handleItemPress} index={index} hasTVPreferredFocus={index === 0} />;
      }
      return <VideoGridItem video={jellyfinItem} onPress={handleItemPress} index={index} hasTVPreferredFocus={index === 0} />;
    },
    [handleItemPress, navigateBack, isLoading],
  );

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) {
      return null;
    }

    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color="#FFC312" />
        <Text style={styles.footerLoadingText}>Loading more...</Text>
      </View>
    );
  }, [isLoadingMore]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreResults && !isLoadingMore && !isLoading) {
      loadMore();
    }
  }, [hasMoreResults, isLoadingMore, isLoading, loadMore]);

  const handleTryDemo = useCallback(async () => {
    if (isConnectingToDemo) return; // Prevent double-click

    setIsConnectingToDemo(true);
    let connected = false;

    try {
      showGlobalLoader();
      await connectToDemoServer();
      connected = true;

      // Refresh folder navigation to load demo content
      await refresh();

      hideGlobalLoader();

      Alert.alert("Demo Server Connected", "You're now browsing Jellyfin's demo library. You can switch to your own server in Settings.", [{ text: "OK" }]);
    } catch (error) {
      hideGlobalLoader();

      if (connected) {
        // Connection succeeded but refresh failed
        Alert.alert("Connected to Demo", "Connected to demo server, but couldn't load the library. Please check your internet connection and try navigating again.", [{ text: "OK" }]);
      } else {
        // Connection failed
        Alert.alert("Connection Failed", error instanceof Error ? error.message : "Unable to connect to demo server", [{ text: "OK" }]);
      }
    } finally {
      setIsConnectingToDemo(false);
    }
  }, [isConnectingToDemo, showGlobalLoader, hideGlobalLoader, refresh]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.buttonGroup}>
            <FocusableButton
              title="Try Demo Server"
              variant="secondary"
              onPress={handleTryDemo}
              disabled={isConnectingToDemo}
              icon={<Ionicons name="play-circle-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />}
              hasTVPreferredFocus={true}
            />
            <FocusableButton
              title="Go to Settings"
              variant="primary"
              onPress={() => router.push("/(tabs)/settings")}
              icon={<Ionicons name="settings-outline" size={Platform.isTV ? 24 : 20} color="#000000" />}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="folder-open-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>This folder is empty</Text>
      </View>
    );
  }, [isLoading, error, isConnectingToDemo, router, handleTryDemo]);

  return (
    <View style={styles.container}>
      {items.length === 0 && !showBackItem ? (
        renderEmpty()
      ) : (
        <FlatList
          testID="library-list"
          data={gridData}
          renderItem={renderItem}
          keyExtractor={(item) => item.Id}
          numColumns={numColumns}
          key={numColumns}
          extraData={currentFolder?.id}
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
      <Breadcrumb stack={folderStack} />
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
  errorTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  errorText: {
    marginTop: 18,
    fontSize: 17,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 20,
    color: "#98989D",
    textAlign: "center",
  },
  footerLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
    gap: 12,
  },
  footerLoadingText: {
    fontSize: Platform.isTV ? 20 : 16,
    color: "#98989D",
    fontWeight: "500",
  },
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 32 : 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
});
