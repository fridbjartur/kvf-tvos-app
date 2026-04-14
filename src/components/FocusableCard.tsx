import { useRef } from "react";
import { Image } from "expo-image";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PressableProps } from "react-native";
import { palette, radii, spacing, type } from "../theme";
import { getUnavailableLabel } from "../utils/content";

type FocusableCardProps = Pick<PressableProps, "nextFocusUp"> & {
  title: string;
  imageUrl: string | null;
  badge?: string;
  disabled?: boolean;
  onPress?: () => void;
  subtitle?: string;
};

export function FocusableCard({
  title,
  imageUrl,
  badge,
  disabled = false,
  onPress,
  nextFocusUp,
  subtitle,
}: FocusableCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function handleFocus() {
    Animated.spring(scale, {
      toValue: 1.08,
      useNativeDriver: true,
      bounciness: 6,
      speed: 18,
    }).start();
  }

  function handleBlur() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
  }

  return (
    <Animated.View
      style={[
        styles.card,
        disabled && styles.cardDisabled,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        focusable={!disabled}
        nextFocusUp={nextFocusUp}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onPress={onPress}
        style={styles.pressable}
      >
        <View style={styles.art}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{badge ?? "KVF"}</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          {disabled ? (
            <Text style={styles.disabledText}>{getUnavailableLabel()}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    borderRadius: radii.md,
    backgroundColor: palette.panel,
  },
  pressable: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  cardDisabled: {
    opacity: 0.4,
  },
  art: {
    height: 170,
    backgroundColor: palette.panelMuted,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panelMuted,
  },
  placeholderText: {
    color: palette.accent,
    fontSize: type.title,
    fontWeight: "900",
    letterSpacing: 3,
  },
  body: {
    padding: spacing.md,
    paddingTop: spacing.sm + 2,
    gap: 4,
  },
  title: {
    color: palette.text,
    fontSize: type.bodyLarge,
    fontWeight: "700",
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: type.body,
  },
  disabledText: {
    color: palette.textMuted,
    fontSize: type.overline,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
