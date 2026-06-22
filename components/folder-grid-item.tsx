import { DESIGN, GRID, slotColumns, slotRatio, type SlotOrientation } from "@/constants/app";
import { getFolderThumbnailUrl } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MarqueeText } from "./MarqueeText";

const IS_TV = Platform.isTV;
const CARD_PADDING = IS_TV ? 16 : 8;
const POSTER_SIZE = IS_TV ? 300 : 200;

interface FolderGridItemProps {
  folder: JellyfinItem;
  onPress: (folder: JellyfinItem) => void;
  index: number;
  hasTVPreferredFocus?: boolean;
  /** Slot shape of the grid this card lives in (drives card aspect ratio + column width). */
  slotOrientation?: SlotOrientation;
}

const FolderGridItemComponent = forwardRef<React.ElementRef<typeof TouchableOpacity>, FolderGridItemProps>(function FolderGridItemComponent(
  { folder, onPress, index, hasTVPreferredFocus = false, slotOrientation = "portrait" },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const thumbnailUrl = useMemo(() => (folder.ImageTags?.Primary ? getFolderThumbnailUrl(folder.Id, POSTER_SIZE) : undefined), [folder.Id, folder.ImageTags?.Primary]);

  const slotIsLandscape = slotOrientation === "landscape";

  // The art fills the slot when their orientations match; otherwise it renders
  // uncropped (landscape art in a portrait slot → top band; portrait art in a
  // landscape slot → centered).
  const imageStyle = useMemo(() => {
    const ratio = folder.PrimaryImageAspectRatio;
    const imageIsLandscape = ratio !== undefined && ratio >= 1;
    if (imageIsLandscape === slotIsLandscape) return styles.poster;
    if (imageIsLandscape) return [styles.posterTop, { aspectRatio: ratio }];
    return [styles.posterCenter, { aspectRatio: ratio ?? GRID.PORTRAIT_RATIO }];
  }, [folder.PrimaryImageAspectRatio, slotIsLandscape]);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const handlePress = useCallback(() => {
    onPress(folder);
  }, [onPress, folder]);

  const itemCount = folder.ChildCount;

  return (
    <TouchableOpacity
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[styles.container, { width: `${100 / slotColumns(slotOrientation, IS_TV)}%` }]}
      accessibilityLabel={folder.Name || "Folder"}
      accessibilityRole="button"
      accessibilityHint={itemCount !== undefined ? `Navigate to ${folder.Name} with ${itemCount} ${itemCount === 1 ? "item" : "items"}` : `Navigate to ${folder.Name}`}>
      <View style={styles.card}>
        <View style={[styles.imageContainer, { aspectRatio: slotRatio(slotOrientation) }, slotIsLandscape && styles.imageContainerCenter]}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={imageStyle} contentFit="cover" transition={0} priority={index < 10 ? "high" : "normal"} cachePolicy="disk" recyclingKey={folder.Id} />
          ) : (
            <View style={styles.placeholderPoster}>
              <Ionicons name="folder" size={IS_TV ? 80 : 50} color="#FFC312" />
            </View>
          )}

          {/* Folder badge indicator - always visible */}
          <View style={styles.folderBadge}>
            <Ionicons name="folder" size={IS_TV ? 20 : 16} color="#FFC312" />
          </View>

          {/* Frosted info panel — always shown (incl. root library folders that lack art) */}
          <BlurView intensity={IS_TV ? 60 : 40} style={styles.infoOverlay} tint="dark">
            <MarqueeText active={focused} style={styles.folderName}>
              {folder.Name}
            </MarqueeText>
            {itemCount !== undefined && (
              <Text style={styles.childCount}>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Text>
            )}
          </BlurView>

          <View style={[styles.borderOverlay, focused && styles.borderOverlayFocused]} pointerEvents="none" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

function arePropsEqual(prev: FolderGridItemProps, next: FolderGridItemProps): boolean {
  return (
    prev.folder.Id === next.folder.Id &&
    prev.folder.PrimaryImageAspectRatio === next.folder.PrimaryImageAspectRatio &&
    prev.index === next.index &&
    prev.onPress === next.onPress &&
    prev.hasTVPreferredFocus === next.hasTVPreferredFocus &&
    prev.slotOrientation === next.slotOrientation
  );
}

export const FolderGridItem = React.memo(FolderGridItemComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    // width is set inline (100/columns% derived from the slot orientation)
    padding: CARD_PADDING,
  },
  card: {
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    // aspectRatio set inline from the slot orientation (portrait 2:3 / landscape 16:9)
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
  },
  imageContainerCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  borderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  borderOverlayFocused: {
    borderColor: "rgba(250, 196, 0, 0.5)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  // Landscape art in a portrait slot: full width, pinned to the top.
  posterTop: {
    width: "100%",
  },
  // Portrait art in a landscape slot: full height, centered by the container.
  posterCenter: {
    height: "100%",
  },
  placeholderPoster: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: IS_TV ? 20 : 12,
  },
  placeholderText: {
    color: "#98989D",
    fontSize: IS_TV ? 30 : 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: IS_TV ? 16 : 10,
  },
  folderBadge: {
    position: "absolute",
    top: IS_TV ? 16 : 10,
    right: IS_TV ? 16 : 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: DESIGN.BORDER_RADIUS_ROUND,
    padding: IS_TV ? 8 : 6,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%", // bottom half of the card
    paddingVertical: IS_TV ? 28 : 16,
    paddingHorizontal: IS_TV ? 20 : 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  folderName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 30 : 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: IS_TV ? 16 : 8, // extra padding above/below the title marquee
    marginBottom: IS_TV ? 12 : 6,
  },
  childCount: {
    color: "#98989D",
    fontSize: IS_TV ? 22 : 11,
    fontWeight: "500",
    marginTop: 4,
  },
});
