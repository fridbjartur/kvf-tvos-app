/**
 * A pulsing placeholder block.
 *
 * Used to hold the space where content may be about to arrive — a slot in a
 * list that a refresh might fill — so new items grow out of a visible
 * placeholder instead of appearing from nowhere.
 *
 * Opacity-only, driven on the UI thread by Reanimated: no layout or colour
 * interpolation runs per frame, which matters on tvOS where the JS thread is
 * also decoding poster images.
 */

import { useEffect } from "react";
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

const IS_TV = Platform.isTV;

const PULSE_MS = 720;
const DIM = 0.4;
const BRIGHT = 0.9;

interface ShimmerBlockProps {
  style?: StyleProp<ViewStyle>;
  /** Staggering siblings stops a row of blocks pulsing as one solid slab. */
  delayMs?: number;
}

export function ShimmerBlock({ style, delayMs = 0 }: ShimmerBlockProps) {
  const pulse = useSharedValue(DIM);

  useEffect(() => {
    // Matching MarqueeText: tvOS gets the animation, and it is always cancelled
    // on unmount so no worklet is left running behind a torn-down view.
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(withTiming(BRIGHT, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), withTiming(DIM, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) })),
        -1,
      );
    }, delayMs);

    return () => {
      clearTimeout(timer);
      cancelAnimation(pulse);
    };
  }, [pulse, delayMs]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View pointerEvents="none" style={[S.block, style, animated]} />;
}

const S = StyleSheet.create({
  block: {
    backgroundColor: IS_TV ? "#3A3A3C" : "#2C2C2E",
    overflow: "hidden",
  },
});
