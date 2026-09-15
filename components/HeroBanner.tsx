import strings from "@/constants/strings.json";
/**
 * HeroBanner — full-width hero slider.
 *
 * Design ported from fridbjartur/kvf-tvos-app (HeroBanner + HeroImage).
 *
 * Architecture:
 *   • Only the current slide and its neighbors mount, bounding decoded image memory.
 *   • Each slide owns its opacity Animated.Value and animates on isActive change.
 *   • The entire banner is ONE TouchableOpacity — D-pad left/right changes slide,
 *     center button opens the program.
 *   • Auto-advance pauses when the banner has focus so the user can navigate freely.
 *   • A non-focusable "Watch" button visually highlights when the banner is focused.
 */

import { ButtonVisual } from "@/components/button-visual";
import { useFocusEffect, useIsFocused } from "expo-router";
import type { FeaturedProgram } from "@/types/kvf";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Platform, StyleSheet, Text, TouchableOpacity, TVFocusGuideView, View, useTVEventHandler, type HWEvent } from "react-native";

const IS_TV = Platform.isTV;

export const HERO_H = IS_TV ? 780 : 460;
const SLIDE_INTERVAL_MS = 8000;
const FADE_MS = 180;

type HeroBannerProps = {
  heroes: FeaturedProgram[];
  onPress: (hero: FeaturedProgram) => void;
  hasTVPreferredFocus?: boolean;
};

// ── Single slide — owns its own opacity ───────────────────────────────────────

type SlideProps = {
  hero: FeaturedProgram;
  isActive: boolean;
  activeIndex: number;
  heroesLength: number;
  focused: boolean;
};

const HeroSlide = memo(function HeroSlide({ hero, isActive, activeIndex, heroesLength, focused }: SlideProps) {
  // useState lazy init: created once, mutated by Animated — no re-render on animate.
  // Avoids the "ref.current during render" lint rule.
  const [opacity] = useState(() => new Animated.Value(isActive ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: isActive ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isActive, opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none" accessibilityElementsHidden={!isActive} importantForAccessibility={isActive ? "auto" : "no-hide-descendants"}>
      <View style={S.slideContainer}>
        {hero.thumbnailUrl ? (
          // MiKS episode links can have empty slugs. Use expo-image's default
          // URL cache identity so unrelated artwork never shares a cache entry.
          <Image source={{ uri: hero.thumbnailUrl }} recyclingKey={hero.thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" priority="high" />
        ) : null}

        <View style={S.dimmer} pointerEvents="none" />

        <LinearGradient colors={["transparent", "rgba(10,10,10,1)"]} style={S.bottomFade} pointerEvents="none" />

        <View style={S.content} pointerEvents="none">
          <Text numberOfLines={2} style={S.title}>
            {hero.title}
          </Text>

          {hero.summary ? (
            <Text numberOfLines={2} style={S.summary}>
              {hero.summary}
            </Text>
          ) : null}

          <View style={S.ctaRow}>
            <ButtonVisual title={strings.heroBanner.watchButton} iconName="play" focused={focused} />

            {heroesLength > 1 && (
              <View style={S.dots}>
                {Array.from({ length: heroesLength }, (_, i) => (
                  <View key={i} style={[S.dot, i === activeIndex && S.dotActive]} />
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ── Banner ─────────────────────────────────────────────────────────────────────

export function HeroBanner({ heroes, onPress, hasTVPreferredFocus }: HeroBannerProps) {
  const screenFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const artworkInset = Platform.OS === "ios" ? insets.top : 0;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);

  // Preserve the selected program when a refresh replaces or reorders the
  // array. If it disappeared, fall back to the first slide without remounting
  // the touchable that owns native focus.
  const activeIndex = Math.max(
    0,
    heroes.findIndex((hero) => hero.listKey === activeKey),
  );
  const activeHero = heroes[activeIndex];

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
    setFocused(true);
  }, []);
  const handleBlur = useCallback(() => {
    focusedRef.current = false;
    setFocused(false);
  }, []);
  useFocusEffect(useCallback(() => handleBlur, [handleBlur]));

  const changeSlide = useCallback(
    (direction: "left" | "right") => {
      if (heroes.length <= 1) return;
      setActiveKey((previous) => {
        const current = Math.max(
          0,
          heroes.findIndex((hero) => hero.listKey === previous),
        );
        const next = (current + (direction === "left" ? -1 : 1) + heroes.length) % heroes.length;
        return heroes[next].listKey;
      });
    },
    [heroes],
  );

  useEffect(() => {
    if (!screenFocused || focused || heroes.length <= 1) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") changeSlide("right");
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [screenFocused, focused, heroes.length, changeSlide]);

  useTVEventHandler(
    useCallback(
      (event: HWEvent) => {
        if (!screenFocused || !focusedRef.current) return;
        // tvOS tap recognizers emit a single Ended (1) event. Android emits
        // down/up pairs; ignore the release only on Android.
        if (Platform.OS === "android" && event.eventKeyAction === 1) return;
        if (event.eventType === "left") changeSlide("left");
        else if (event.eventType === "right") changeSlide("right");
      },
      [screenFocused, changeSlide],
    ),
  );

  if (!activeHero) return null;

  return (
    // Artwork extends into the scroll view's top safe-area inset, but the
    // focusable rectangle starts below the tab bar. UIKit can then find the
    // tabs above it and keep automatic scroll/inset coordination enabled.
    <View style={[S.frame, { height: Math.max(1, HERO_H - artworkInset) }]}>
      <View pointerEvents="none" style={[S.artwork, { top: -artworkInset }]}>
        {heroes.map((hero, i) => {
          const distance = (i - activeIndex + heroes.length) % heroes.length;
          if (distance > 1 && distance < heroes.length - 1) return null;
          return <HeroSlide key={hero.listKey} hero={hero} isActive={i === activeIndex} activeIndex={activeIndex} heroesLength={heroes.length} focused={focused} />;
        })}
      </View>
      <TVFocusGuideView autoFocus trapFocusLeft trapFocusRight style={S.focusArea}>
        <TouchableOpacity
          activeOpacity={1}
          isTVSelectable={screenFocused}
          disabled={!screenFocused}
          tvParallaxProperties={{ enabled: false }}
          hasTVPreferredFocus={screenFocused && hasTVPreferredFocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityRole="button"
          accessibilityLabel={`${activeHero.title}. ${strings.heroBanner.watchButton}`}
          onPress={() => {
            if (screenFocused) onPress(activeHero);
          }}
          style={S.focusArea}
        />
      </TVFocusGuideView>
    </View>
  );
}

const S = StyleSheet.create({
  frame: {
    width: "100%",
  },
  artwork: { position: "absolute", left: 0, right: 0, bottom: 0 },
  focusArea: { flex: 1 },
  slideContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
  },
  dimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "78%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: IS_TV ? 80 : 20,
    paddingBottom: IS_TV ? 48 : 20,
    gap: IS_TV ? 10 : 6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 52 : 22,
    fontWeight: "700",
    maxWidth: IS_TV ? "52%" : "80%",
    lineHeight: IS_TV ? 62 : 28,
    letterSpacing: -0.5,
  },
  summary: {
    color: "rgba(255,255,255,0.68)",
    fontSize: IS_TV ? 20 : 13,
    maxWidth: IS_TV ? "34%" : "75%",
    lineHeight: IS_TV ? 30 : 19,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: IS_TV ? 16 : 8,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 8 : 5,
  },
  dot: {
    width: IS_TV ? 12 : 6,
    height: IS_TV ? 12 : 6,
    borderRadius: IS_TV ? 6 : 3,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: IS_TV ? 28 : 14,
  },
});
