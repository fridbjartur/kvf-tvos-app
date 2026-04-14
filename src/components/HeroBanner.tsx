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
import { Button } from "./Button";
import { HeroImage } from "./HeroImage";
import { palette, radii, spacing, type } from "../theme";

type HeroBannerProps = {
  heroes: HomeHeroItem[];
  onPress: (hero: HomeHeroItem) => void;
};

const SLIDE_INTERVAL_MS = 6000;
const FADE_DURATION_MS = 180;

export function HeroBanner({ heroes, onPress }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  // Refs so the stable callbacks can read current values without becoming stale
  const focusedRef = useRef(false);
  const activeIndexRef = useRef(0);
  const heroesLengthRef = useRef(heroes.length);
  const transitionInProgress = useRef(false);
  focusedRef.current = focused;
  activeIndexRef.current = activeIndex;
  heroesLengthRef.current = heroes.length;

  // One Animated.Value per slide — all slides stay mounted so images load upfront.
  // Lazily rebuild when the heroes array reference changes (section switch).
  const slideOpacities = useRef<Animated.Value[]>([]);
  if (slideOpacities.current.length !== heroes.length) {
    slideOpacities.current = heroes.map((_, i) => new Animated.Value(i === 0 ? 1 : 0));
  }

  // Reset to first slide when heroes change (e.g. section switch)
  useEffect(() => {
    transitionInProgress.current = false;
    slideOpacities.current.forEach((v, i) => v.setValue(i === 0 ? 1 : 0));
    setActiveIndex(0);
  }, [heroes]);

  // Cross-fade: fade current out while fading next in simultaneously.
  const changeSlide = useCallback((direction: "left" | "right") => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;

    const currentIdx = activeIndexRef.current;
    const length = heroesLengthRef.current;
    const nextIdx =
      direction === "left"
        ? currentIdx === 0 ? length - 1 : currentIdx - 1
        : (currentIdx + 1) % length;

    // Update dots immediately so they feel responsive
    setActiveIndex(nextIdx);
    activeIndexRef.current = nextIdx;

    const opacities = slideOpacities.current;
    Animated.parallel([
      Animated.timing(opacities[currentIdx], {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacities[nextIdx], {
        toValue: 1,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      transitionInProgress.current = false;
    });
  }, []);

  // Auto-advance — pauses when focused so user can navigate freely
  useEffect(() => {
    if (focused || heroes.length <= 1) return;
    const timer = setInterval(() => changeSlide("right"), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [focused, heroes.length, changeSlide]);

  // D-pad left/right to navigate slides when the hero is focused
  const handleTVEvent = useCallback((event: HWEvent) => {
    if (!focusedRef.current) return;
    if (event.eventType === "left") changeSlide("left");
    else if (event.eventType === "right") changeSlide("right");
  }, [changeSlide]);

  useTVEventHandler(handleTVEvent);

  const hero = heroes[activeIndex] ?? null;

  if (!hero) return null;

  return (
    <Pressable
      focusable={hero.canOpenProgram}
      disabled={!hero.canOpenProgram}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => onPress(hero)}
      style={styles.hero}
    >
      <View style={styles.heroFrame}>
        {heroes.map((h, i) => (
          <Animated.View
            key={i}
            pointerEvents={i === activeIndex ? "auto" : "none"}
            style={[styles.heroLayer, { opacity: slideOpacities.current[i] }]}
          >
            <HeroSlide
              activeIndex={activeIndex}
              focused={focused}
              hero={h}
              heroesLength={heroes.length}
            />
          </Animated.View>
        ))}
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
          <Button
            focusable={false}
            focused={focused}
            label={getOpenProgramLabel()}
            pointerEvents="none"
            size="lg"
            style={styles.ctaButton}
            textStyle={styles.ctaText}
          />
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
    height: 580,
  },
  heroLayer: {
    ...StyleSheet.absoluteFillObject,
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
    pointerEvents: "none",
  },
  ctaText: {
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
});
