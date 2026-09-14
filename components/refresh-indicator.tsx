import { LoadingSpinner } from "@/components/loading-spinner";
/**
 * Passive "checking for new content" affordance.
 *
 * The app is stale-while-revalidate: cached data paints immediately and a
 * refresh runs behind it. Without a signal, anything the refresh turns up — a
 * newly published episode — simply appears, which reads as a glitch. This says
 * "more may be coming" without ever blocking or moving the content underneath.
 *
 * It is deliberately unfocusable and `pointerEvents="none"`: on tvOS anything
 * focusable in a screen's root competes with the content for the focus engine.
 */

import { useEffect } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import strings from "@/constants/strings.json";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";

const IS_TV = Platform.isTV;

const FADE_MS = 220;

interface RefreshIndicatorProps {
  /** Raw `isRefreshing`; the smoothing to avoid a flash is handled here. */
  active: boolean;
  /**
   * `overlay` parks it in the top-right of the screen, clear of tvOS overscan.
   * `inline` sits in a row of content, e.g. beside a section heading.
   */
  variant?: "overlay" | "inline";
  label?: string;
}

export function RefreshIndicator({ active, variant = "overlay", label = strings.common.updating }: RefreshIndicatorProps) {
  const visible = useDelayedFlag(active);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(visible ? 1 : 0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
  }, [visible, fade]);

  const container = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
      accessibilityLabel={label}
      style={[variant === "overlay" ? S.overlay : S.inline, container]}>
      {/* Spins only while shown, but stays laid out through the fade-out so it
          cannot pop away before the pill behind it has finished disappearing. */}
      <LoadingSpinner animating={visible} hidesWhenStopped={false} />
      <Text style={S.label}>{label}</Text>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  // Inset past the tvOS title-safe margin so it is never clipped by overscan.
  overlay: {
    position: "absolute",
    top: IS_TV ? 48 : 12,
    right: IS_TV ? 64 : 16,
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 12 : 8,
    paddingHorizontal: IS_TV ? 20 : 12,
    paddingVertical: IS_TV ? 10 : 6,
    borderRadius: IS_TV ? 22 : 14,
    backgroundColor: "rgba(20,20,22,0.82)",
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: "#8E8E93",
    fontSize: IS_TV ? 16 : 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
