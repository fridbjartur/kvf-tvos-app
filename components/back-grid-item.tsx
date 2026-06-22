import { DESIGN, slotColumns, slotRatio, type SlotOrientation } from "@/constants/app";
import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useCallback, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const IS_TV = Platform.isTV;
const CARD_PADDING = IS_TV ? 16 : 8;

interface BackGridItemProps {
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  isLoading?: boolean;
  /** Slot shape of the grid this card lives in (matches sibling cards). */
  slotOrientation?: SlotOrientation;
}

const BackGridItemComponent = forwardRef<React.ElementRef<typeof TouchableOpacity>, BackGridItemProps>(function BackGridItemComponent(
  { onPress, hasTVPreferredFocus = false, isLoading = false, slotOrientation = "portrait" },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  return (
    <TouchableOpacity
      ref={ref}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel="Go Back"
      accessibilityRole="button"
      accessibilityHint="Return to previous folder"
      style={[styles.container, { width: `${100 / slotColumns(slotOrientation, IS_TV)}%` }]}>
      <View style={styles.card}>
        <View style={[styles.imageContainer, { aspectRatio: slotRatio(slotOrientation) }]}>
          <View style={styles.placeholderPoster}>
            {isLoading ? <ActivityIndicator size="small" color="rgba(250, 196, 0, 0.5)" /> : <Ionicons name="return-up-back" size={IS_TV ? 80 : 50} color="rgba(250, 196, 0, 0.5)" />}
            <Text style={styles.placeholderText}> </Text>
          </View>

          <View style={styles.folderBadge}>
            <Ionicons name="arrow-back" size={IS_TV ? 20 : 16} color="#FFC312" />
          </View>

          <View style={styles.infoOverlay}>
            <Text style={styles.hint}>Go Back</Text>
          </View>

          <View style={[styles.borderOverlay, focused && styles.borderOverlayFocused]} pointerEvents="none" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const BackGridItem = React.memo(BackGridItemComponent);

const styles = StyleSheet.create({
  container: {
    // width set inline (100/columns% from the slot orientation)
    padding: CARD_PADDING,
  },
  card: {
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    // aspectRatio set inline from the slot orientation
    justifyContent: "center",
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
  },
  borderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    borderWidth: 2,
    borderColor: "rgba(250, 196, 0, 0.1)",
  },
  borderOverlayFocused: {
    borderColor: "rgba(250, 196, 0, 0.5)",
    shadowColor: "rgba(250, 196, 0, 0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
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
    color: "rgba(250, 196, 0, 0.5)",
    fontSize: IS_TV ? 32 : 24,
    fontWeight: "700",
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
    paddingVertical: IS_TV ? 10 : 6,
    paddingHorizontal: IS_TV ? 16 : 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  folderName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 30 : 13,
    fontWeight: "700",
    textAlign: "center",
  },
  hint: {
    color: "rgba(250, 196, 0, 0.5)",
    fontSize: IS_TV ? 22 : 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
