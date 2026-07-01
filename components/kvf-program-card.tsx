/**
 * Landscape (16:9) program card.
 *
 * Design: sharp corners, smooth spring scale on focus, white border on focus.
 */

import type { ProgramCard } from "@/types/kvf";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useCallback, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MarqueeText } from "./MarqueeText";
import { DESIGN } from "@/constants/app";

const IS_TV = Platform.isTV;
const SPRING = { tension: 220, friction: 22, useNativeDriver: true } as const;
const SCALE_FOCUSED = 1.05;
const ASPECT_RATIO = 16 / 10;

interface KvfProgramCardProps {
  program: ProgramCard;
  onPress: (program: ProgramCard) => void;
  onFocus?: (program: ProgramCard) => void;
  cardWidth: number;
  index?: number;
  hasTVPreferredFocus?: boolean;
}

function KvfProgramCardComponent({ program, onPress, onFocus, cardWidth, index = 0, hasTVPreferredFocus }: KvfProgramCardProps) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.spring(scale, { toValue: SCALE_FOCUSED, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 1, ...SPRING }).start();
    onFocus?.(program);
  }, [scale, borderOpacity, onFocus, program]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 0, ...SPRING }).start();
  }, [scale, borderOpacity]);

  const handlePress = useCallback(() => onPress(program), [onPress, program]);

  const imageSource = program.thumbnailUrl ? { uri: program.thumbnailUrl, cacheKey: `prog-${program.slug}` } : null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[S.outer, { width: cardWidth + (IS_TV ? 32 : 20) }]}
      accessibilityLabel={program.title}
      accessibilityRole="button">
      <Animated.View style={[S.card, { width: cardWidth, transform: [{ scale }] }]}>
        {imageSource ? (
          <Image source={imageSource} style={S.image} contentFit="cover" transition={0} priority={index < 6 ? "high" : "normal"} cachePolicy="memory-disk" recyclingKey={program.slug} />
        ) : (
          <View style={S.placeholder}>
            <Text style={S.placeholderText} numberOfLines={2}>
              {program.title}
            </Text>
          </View>
        )}

        {/* Title bar */}
        <BlurView intensity={60} style={S.titleBar}>
          <MarqueeText active={focused} style={S.titleText}>
            {program.title}
          </MarqueeText>
        </BlurView>

        {/* White border on focus */}
        <Animated.View style={[S.border, { opacity: borderOpacity }]} pointerEvents="none" />
      </Animated.View>
    </TouchableOpacity>
  );
}

export const KvfProgramCard = KvfProgramCardComponent;

// Named "S" (not "styles") to prevent editor auto-import from shadowing this with an external module.
const S = StyleSheet.create({
  outer: {
    paddingHorizontal: IS_TV ? 16 : 10,
    paddingVertical: IS_TV ? 18 : 12,
  },
  card: {
    aspectRatio: ASPECT_RATIO,
    overflow: "hidden",
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    backgroundColor: "#1C1C1E",
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  placeholderText: {
    color: "#636366",
    fontSize: IS_TV ? 18 : 13,
    fontWeight: "600",
    textAlign: "center",
  },
  titleBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    paddingVertical: IS_TV ? 9 : 5,
    paddingHorizontal: IS_TV ? 14 : 9,
    overflow: "hidden",
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 19 : 12,
    fontWeight: "600",
    opacity: 0.75,
    textAlign: "left",
  },
  border: {
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
