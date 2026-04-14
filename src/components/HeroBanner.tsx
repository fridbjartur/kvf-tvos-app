import type { Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useTVEventHandler,
  type HWEvent,
} from "react-native";
import type { HomeHeroItem } from "../api/types";
import {
  getHeroFallbackSummary,
  getOpenProgramLabel,
  getUnavailableLabel,
} from "../utils/content";
import { HeroImage } from "./HeroImage";
import { palette, radii, spacing, type } from "../theme";

type HeroBannerProps = {
  heroes: HomeHeroItem[];
  onPress: (hero: HomeHeroItem) => void;
  heroRef?: Ref<View>;
  nextFocusDown?: number;
  nextFocusUp?: number;
};

const SLIDE_INTERVAL_MS = 6000;
const FADE_DURATION_MS = 240;
const NAV_REPEAT_GUARD_MS = 180;

export function HeroBanner({
  heroes,
  onPress,
  heroRef,
  nextFocusDown,
  nextFocusUp,
}: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const transitionOpacity = useRef(new Animated.Value(0)).current;

  // Refs for stable callback access
  const focusedRef = useRef(false);
  const heroesLengthRef = useRef(heroes.length);
  const lastActiveIndexRef = useRef(0);
  const lastManualNavigationAtRef = useRef(0);
  focusedRef.current = focused;
  heroesLengthRef.current = heroes.length;

  // Reset to first slide when heroes change (e.g. section switch)
  useEffect(() => {
    setActiveIndex(0);
    setPreviousIndex(null);
    transitionOpacity.stopAnimation();
    transitionOpacity.setValue(0);
    lastActiveIndexRef.current = 0;
  }, [heroes]);

  useEffect(() => {
    const previous = lastActiveIndexRef.current;

    if (previous === activeIndex) {
      return;
    }

    setPreviousIndex(previous);
    transitionOpacity.stopAnimation();
    transitionOpacity.setValue(1);

    Animated.timing(transitionOpacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPreviousIndex((current) => (current === previous ? null : current));
      }
    });

    lastActiveIndexRef.current = activeIndex;
  }, [activeIndex, transitionOpacity]);

  // Auto-advance — pauses when focused so user can navigate freely
  useEffect(() => {
    if (focused || heroes.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % heroes.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [focused, heroes.length]);

  const changeSlide = useCallback((direction: "left" | "right") => {
    setActiveIndex((prev) => {
      if (direction === "left") {
        return prev === 0 ? heroesLengthRef.current - 1 : prev - 1;
      }

      return (prev + 1) % heroesLengthRef.current;
    });
  }, []);

  // D-pad left/right to navigate slides when the hero is focused
  const handleTVEvent = useCallback((event: HWEvent) => {
    if (!focusedRef.current) return;

    const now = Date.now();
    if (now - lastManualNavigationAtRef.current < NAV_REPEAT_GUARD_MS) {
      return;
    }

    if (event.eventType === "left") {
      lastManualNavigationAtRef.current = now;
      changeSlide("left");
    } else if (event.eventType === "right") {
      lastManualNavigationAtRef.current = now;
      changeSlide("right");
    }
  }, [changeSlide]);

  useTVEventHandler(handleTVEvent);

  const hero = heroes[activeIndex] ?? null;
  const previousHero =
    previousIndex !== null ? (heroes[previousIndex] ?? null) : null;

  if (!hero) {
    return null;
  }

  return (
    <Pressable
      ref={heroRef}
      focusable={hero.canOpenProgram}
      disabled={!hero.canOpenProgram}
      nextFocusDown={nextFocusDown}
      nextFocusUp={nextFocusUp}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => onPress(hero)}
      style={styles.hero}
    >
      <View style={styles.heroFrame}>
        <HeroSlide
          activeIndex={activeIndex}
          focused={focused}
          hero={hero}
          heroesLength={heroes.length}
        />
        {previousHero ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.heroLayer, { opacity: transitionOpacity }]}
          >
            <HeroSlide
              activeIndex={activeIndex}
              focused={focused}
              hero={previousHero}
              heroesLength={heroes.length}
            />
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
}

function HeroSlide({
  activeIndex,
  hero,
  focused,
  heroesLength,
}: {
  activeIndex: number;
  hero: HomeHeroItem;
  focused: boolean;
  heroesLength: number;
}) {
  return (
    <HeroImage imageUrl={hero.imageUrl} height={580}>
      <Text numberOfLines={2} style={styles.title}>
        {hero.title}
      </Text>
      <Text numberOfLines={2} style={styles.summary}>
        {hero.summary ?? getHeroFallbackSummary()}
      </Text>

      <View style={styles.ctaRow}>
        {hero.canOpenProgram ? (
          <View
            style={[styles.ctaButton, focused && styles.ctaButtonFocused]}
          >
            <Text style={styles.ctaText}>{getOpenProgramLabel()}</Text>
          </View>
        ) : (
          <View style={styles.ctaButtonMuted}>
            <Text style={styles.ctaTextMuted}>{getUnavailableLabel()}</Text>
          </View>
        )}

        {heroesLength > 1 ? (
          <View style={styles.dots}>
            {Array.from({ length: heroesLength }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </HeroImage>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.md,
  },
  heroFrame: {
    position: "relative",
    height: 580,
  },
  heroLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: type.body,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2.5,
  },
  title: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: "900",
    maxWidth: "50%",
    lineHeight: 62,
  },
  summary: {
    color: "rgba(255,255,255,0.68)",
    fontSize: type.bodyLarge,
    maxWidth: "30%",
    lineHeight: 32,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  ctaButton: {
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  ctaButtonFocused: {
    backgroundColor: "#FFFFFF",
  },
  ctaText: {
    color: "#0B0B0B",
    fontSize: type.bodyLarge,
    fontWeight: "900",
  },
  ctaButtonMuted: {
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  ctaTextMuted: {
    color: "rgba(255,255,255,0.5)",
    fontSize: type.bodyLarge,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 28,
  },
  emptyHero: {
    height: 400,
    borderRadius: radii.lg,
    backgroundColor: palette.panel,
    padding: spacing.xl,
    justifyContent: "flex-end",
    marginTop: spacing.md,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: type.display,
    fontWeight: "900",
  },
  emptyCopy: {
    color: palette.textMuted,
    fontSize: type.bodyLarge,
  },
});
