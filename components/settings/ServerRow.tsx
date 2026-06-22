import { settingsStyles } from "./styles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type ServerRowVariant = "add" | "server" | "demo";

interface ServerRowProps {
  variant: ServerRowVariant;
  /** Row label (server name, or the CTA label for the add variant). */
  name: string;
  onPress: () => void;
  onLongPress?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  hasTVPreferredFocus?: boolean;
}

/**
 * ServerRow - A full-width list row with a small leading icon, so server names
 * read in full. Used for the add CTA and each saved/demo server destination.
 */
export function ServerRow({ variant, name, onPress, onLongPress, isLoading = false, disabled = false, hasTVPreferredFocus = false }: ServerRowProps) {
  const iconName = variant === "add" ? "add-circle-outline" : "server-outline";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || isLoading}
      isTVSelectable={!disabled && !isLoading}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={name}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      tvParallaxProperties={{ magnification: 1.02 }}
      style={({ focused }) => [settingsStyles.listItem, focused && styles.rowFocused, (disabled || isLoading) && styles.rowDisabled]}>
      <View style={settingsStyles.listItemContent}>
        <View style={styles.left}>
          <Ionicons name={iconName} size={Platform.isTV ? 32 : 22} color="#FFC312" />
          <Text style={settingsStyles.listItemTitle} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {isLoading ? <ActivityIndicator color="#FFC312" size="small" /> : <Ionicons name="chevron-forward" size={Platform.isTV ? 28 : 20} color="#8E8E93" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Platform.isTV ? 16 : 12,
  },
  rowFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  rowDisabled: {
    opacity: 0.5,
  },
});
