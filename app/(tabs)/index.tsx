import { AmbientBackground } from "@/components/ambient-background";
import { BackGridItem } from "@/components/back-grid-item";
import { Breadcrumb } from "@/components/breadcrumb";
import { ContinueWatchingRow } from "@/components/continue-watching-row";
import { FocusableButton } from "@/components/FocusableButton";
import { FolderGridItem } from "@/components/folder-grid-item";
import { VideoGridItem } from "@/components/video-grid-item";
import { slotColumns, type SlotOrientation } from "@/constants/app";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLoading } from "@/contexts/LoadingContext";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { PosterBackdropProvider, usePosterBackdropDispatch } from "@/contexts/PosterBackdropContext";
import { connectToDemoServer, isFolder } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, FlatList, Platform, StyleSheet, Text, View, useTVEventHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Special marker for the ".." back navigation item
const BACK_ITEM_ID = "__BACK__";
type GridItem = JellyfinItem | { Id: typeof BACK_ITEM_ID; _isBackItem: true };

const IS_TV = Platform.isTV;

// TV tab bar is ~210px tall, phone tab bars are ~49px + safe area
const TAB_BAR_HEIGHT = IS_TV ? 210 : 49;

function LibraryGrid() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  const { items, isLoading, isLoadingMore, hasMoreResults, error, folderStack, currentFolder, navigateToFolder, navigateBack, loadMore, refresh } = useFolderNavigation();
  const { buildQueue } = usePlayQueue();
  const backdrop = usePosterBackdropDispatch();
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

  // Pick the grid's slot shape from the folder's dominant content orientation.
  const slotOrientation = useMemo<SlotOrientation>(() => {
    const rated = items.filter((i) => i.PrimaryImageAspectRatio != null);
    if (rated.length === 0) return "portrait";
    const landscape = rated.filter((i) => (i.PrimaryImageAspectRatio as number) >= 1).length;
    return landscape > rated.length / 2 ? "landscape" : "portrait";
  }, [items]);

  const numColumns = useMemo(() => slotColumns(slotOrientation, IS_TV), [slotOrientation]);

  // Dynamic content padding that accounts for tab bar safe area
  const gridContentStyle = useMemo(
    () => ({
      ...styles.gridContent,
      paddingTop: (Platform.isTV ? 20 : 10) + insets.top + 80,
      paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
    }),
    [insets.top, insets.bottom],
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

  // Stable focus handler that drives the dynamic poster backdrop. Stable identity keeps
  // the grid cards' React.memo intact so they don't re-render on focus changes.
  // Focus-only (no blur→clear): on tvOS the incoming card's onFocus can fire before the
  // outgoing card's onBlur, so clearing on blur would race and cancel the new poster. We
  // keep the last focused poster instead (Netflix-style) and let each new focus replace it.
  const handleItemFocus = useCallback((item: JellyfinItem) => backdrop.focus(item), [backdrop]);

  const renderItem = useCallback(
    ({ item, index }: { item: GridItem; index: number }) => {
      // Back navigation item — grabs initial focus so you can go back quickly.
      if ("_isBackItem" in item && item._isBackItem) {
        return <BackGridItem onPress={navigateBack} hasTVPreferredFocus={true} isLoading={isLoading} slotOrientation={slotOrientation} />;
      }

      const jellyfinItem = item as JellyfinItem;
      if (isFolder(jellyfinItem)) {
        return <FolderGridItem folder={jellyfinItem} onPress={handleItemPress} index={index} onItemFocus={handleItemFocus} hasTVPreferredFocus={index === 0} slotOrientation={slotOrientation} />;
      }
      return <VideoGridItem video={jellyfinItem} onPress={handleItemPress} index={index} onItemFocus={handleItemFocus} hasTVPreferredFocus={index === 0} slotOrientation={slotOrientation} />;
    },
    [handleItemPress, navigateBack, isLoading, slotOrientation, handleItemFocus],
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
            {/* <FocusableButton
              title="Try Demo Server"
              variant="secondary"
              onPress={handleTryDemo}
              disabled={isConnectingToDemo}
              icon={<Ionicons name="play-circle-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />}
              hasTVPreferredFocus={true}
            /> */}
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
      <AmbientBackground dynamic />
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
          ListHeaderComponent={
            showBackItem ? undefined : (
              <>
                <ContinueWatchingRow />
                <Text style={styles.serverHeading}>Libraries</Text>
              </>
            )
          }
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

export default function VideoLibraryScreen() {
  // Scope the backdrop to this tab so its poster wash never leaks into other tabs.
  return (
    <PosterBackdropProvider>
      <LibraryGrid />
    </PosterBackdropProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gridContent: {
    paddingLeft: Platform.isTV ? 80 : 60,
    paddingRight: Platform.isTV ? 40 : 20,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: 24,
  },
  serverHeading: {
    marginLeft: IS_TV ? 16 : 8,
    marginBottom: IS_TV ? 4 : 2,
    fontSize: IS_TV ? 28 : 18,
    fontWeight: "700",
    color: "#FFFFFF",
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
