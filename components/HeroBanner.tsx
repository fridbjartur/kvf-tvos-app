import strings from "@/constants/strings.json";
/**
 * HeroBanner — full-width hero slider.
 *
 * Design ported from fridbjartur/kvf-tvos-app (HeroBanner + HeroImage).
 *
 * Architecture:
 *   • All slides are mounted simultaneously (absolute stack) so images preload.
 *   • Each slide owns its opacity Animated.Value and animates on isActive change.
 *   • The entire banner is ONE TouchableOpacity — D-pad left/right changes slide,
 *     center button opens the program.
 *   • Auto-advance pauses when the banner has focus so the user can navigate freely.
 *   • A non-focusable "Watch" button visually highlights when the banner is focused.
 */

import type { FeaturedProgram } from "@/types/kvf";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View, useTVEventHandler, type HWEvent } from "react-native";
import { FocusableButton } from "./FocusableButton";

const IS_TV = Platform.isTV;
const { width: SCREEN_W } = Dimensions.get("window");

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

function HeroSlide({ hero, isActive, activeIndex, heroesLength, focused }: SlideProps) {
  // useState lazy init: created once, mutated by Animated — no re-render on animate.
  // Avoids the "ref.current during render" lint rule.
  const [opacity] = useState(() => new Animated.Value(isActive ? 1 : 0));

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [isActive, opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents={isActive ? "auto" : "none"}>
      <View style={S.slideContainer}>
        {hero.thumbnailUrl ? (
          <Image source={{ uri: hero.thumbnailUrl, cacheKey: `hero-${hero.slug}` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" priority="high" />
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
            {/* "Watch" — visual only, focus is on the parent TouchableOpacity */}
            {/* <View style={[S.ctaButton, focused && S.ctaButtonFocused]}>
              <Text style={[S.ctaText, focused && S.ctaTextFocused]}>{strings.heroBanner.watchButton}</Text>
            </View> */}
            <FocusableButton title={strings.heroBanner.watchButton} variant={focused ? "primary" : "secondary"} focus={focused} hasTVPreferredFocus={false} />

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
}

// ── Banner ─────────────────────────────────────────────────────────────────────

export function HeroBanner({ heroes, onPress, hasTVPreferredFocus }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  // Stable refs for callbacks
  const focusedRef = useRef(false);
  const activeIndexRef = useRef(0);
  const heroesLengthRef = useRef(heroes.length);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    heroesLengthRef.current = heroes.length;
  }, [heroes.length]);

  // Reset to slide 0 when heroes changes
  useEffect(() => {
    setActiveIndex(0);
  }, [heroes]);

  const changeSlide = useCallback((direction: "left" | "right") => {
    const current = activeIndexRef.current;
    const length = heroesLengthRef.current;
    const next = direction === "left" ? (current === 0 ? length - 1 : current - 1) : (current + 1) % length;
    setActiveIndex(next);
    activeIndexRef.current = next;
  }, []);

  useEffect(() => {
    if (focused || heroes.length <= 1) return;
    const timer = setInterval(() => changeSlide("right"), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [focused, heroes.length, changeSlide]);

  useTVEventHandler(
    useCallback(
      (event: HWEvent) => {
        if (!focusedRef.current) return;
        if (event.eventType === "left") changeSlide("left");
        else if (event.eventType === "right") changeSlide("right");
      },
      [changeSlide],
    ),
  );

  const activeHero = heroes[activeIndex] ?? null;
  if (!activeHero || heroes.length === 0) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      isTVSelectable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(activeHero)}
      style={S.frame}>
      {heroes.map((hero, i) => (
        <HeroSlide key={hero.slug} hero={hero} isActive={i === activeIndex} activeIndex={activeIndex} heroesLength={heroes.length} focused={focused} />
      ))}
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  frame: {
    width: SCREEN_W,
    height: HERO_H,
  },
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
  ctaButton: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: IS_TV ? 32 : 16,
    paddingVertical: IS_TV ? 14 : 8,
    borderWidth: IS_TV ? 2 : 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  ctaButtonFocused: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  ctaText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: IS_TV ? 22 : 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  ctaTextFocused: {
    color: "#000000",
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
