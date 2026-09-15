/**
 * Ljóð — the sub-section picker, and the Ljóð tab's root screen.
 *
 * Radio splits into two audiences that share nothing, so the tab opens on the
 * choice and nothing else. Picking one pushes onto the tab's own stack, so the
 * tab bar stays on screen and the remote's back button returns here.
 *
 * Uses the shared scroll/focus boundary so the header and choices move together.
 */

import { TVScreenScrollView } from "@/components/tv-screen-scroll-view";
import { FocusScaleCard } from "@/components/focus-scale-card";
import type { SectionId } from "@/constants/sections";
import strings from "@/constants/strings.json";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const IS_TV = Platform.isTV;

interface Choice {
  section: SectionId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
}

const CHOICES: Choice[] = [
  {
    section: "ljod",
    title: strings.ljodPicker.ljodTitle,
    subtitle: strings.ljodPicker.ljodSubtitle,
    icon: "headset-outline",
    colors: ["#34336B", "#141422"],
  },
  {
    section: "ljod-vit",
    title: strings.ljodPicker.vitTitle,
    subtitle: strings.ljodPicker.vitSubtitle,
    icon: "sparkles-outline",
    colors: ["#75334F", "#25151F"],
  },
];

function ChoiceCard({ choice, onPress }: { choice: Choice; onPress: (section: SectionId) => void }) {
  const handlePress = useCallback(() => onPress(choice.section), [onPress, choice.section]);

  return (
    <FocusScaleCard onPress={handlePress} scaleTo={1.025} style={S.cardSlot} cardStyle={S.card} borderStyle={S.cardBorder} accessibilityLabel={`${choice.title}. ${choice.subtitle}`}>
      {(focused) => (
        <LinearGradient colors={choice.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.cardFill}>
          <View style={S.artwork} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={S.orbitOuter} />
            <View style={S.orbitInner} />
            <View style={S.waveform}>
              {[22, 38, 58, 34, 72, 100, 64, 42, 82, 54, 30, 48, 24].map((height, index) => (
                <View key={index} style={[S.waveBar, { height: `${height}%`, opacity: 0.12 + (index % 4) * 0.06 }]} />
              ))}
            </View>
          </View>
          <View style={S.iconBadge}>
            <Ionicons name={choice.icon} size={IS_TV ? 36 : 26} color="#FFFFFF" />
          </View>
          <View style={S.cardBottom}>
            <View style={S.cardText}>
              <Text style={S.cardTitle}>{choice.title}</Text>
              <Text style={S.cardSubtitle}>{choice.subtitle}</Text>
            </View>
            <View style={[S.arrow, focused && S.arrowFocused]}>
              <Ionicons name="arrow-forward" size={IS_TV ? 26 : 20} color={focused ? "#141414" : "#FFFFFF"} />
            </View>
          </View>
        </LinearGradient>
      )}
    </FocusScaleCard>
  );
}

export default function LjodPickerScreen() {
  const router = useRouter();

  // Ignore repeated Select events until this screen becomes active again.
  const navigatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  const handleSelect = useCallback(
    (section: SectionId) => {
      // One push per visit: a second press while the stack is still animating
      // stacks a duplicate screen, so going back appears to do nothing.
      if (navigatingRef.current) return;
      navigatingRef.current = true;

      router.push({ pathname: "/(tabs)/ljod/[section]", params: { section } });
    },
    [router],
  );

  return (
    <TVScreenScrollView contentContainerStyle={S.container}>
      <View style={S.centered}>
        <View style={S.header}>
          <Text style={S.heading}>{strings.ljodPicker.heading}</Text>
          <Text style={S.subheading}>{strings.ljodPicker.subheading}</Text>
        </View>

        <View style={S.grid}>
          {CHOICES.map((choice) => (
            <ChoiceCard key={choice.section} choice={choice} onPress={handleSelect} />
          ))}
        </View>
      </View>
    </TVScreenScrollView>
  );
}

// Named "S" not "styles" — prevents editor auto-import from shadowing the local definition.
const S = StyleSheet.create({
  container: { paddingTop: IS_TV ? 56 : 32, paddingBottom: IS_TV ? 96 : 40, paddingHorizontal: IS_TV ? 80 : 24 },
  centered: { width: "100%", maxWidth: 1600, alignSelf: "center", gap: IS_TV ? 36 : 28 },
  header: { gap: IS_TV ? 12 : 8 },
  heading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 56 : 30,
    lineHeight: IS_TV ? 64 : 38,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subheading: {
    color: "#A9A9B3",
    fontSize: IS_TV ? 22 : 14,
    fontWeight: "500",
  },
  grid: {
    flexDirection: IS_TV ? "row" : "column",
    gap: IS_TV ? 32 : 20,
  },
  cardSlot: { flex: IS_TV ? 1 : undefined, minWidth: 0 },

  // No overflow:hidden on the card itself — the border must not be clipped as it scales.
  card: {
    width: "100%",
    height: IS_TV ? 380 : 224,
    borderRadius: IS_TV ? 18 : 14,
  },
  cardFill: {
    flex: 1,
    borderRadius: IS_TV ? 18 : 14,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: IS_TV ? 36 : 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  artwork: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  orbitOuter: {
    position: "absolute",
    width: IS_TV ? 440 : 280,
    height: IS_TV ? 440 : 280,
    borderRadius: 300,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    top: IS_TV ? -180 : -120,
    right: -40,
  },
  orbitInner: {
    position: "absolute",
    width: IS_TV ? 320 : 200,
    height: IS_TV ? 320 : 200,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    top: IS_TV ? -120 : -80,
    right: 20,
  },
  waveform: {
    position: "absolute",
    right: "8%",
    top: "12%",
    width: "48%",
    height: "42%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    transform: [{ rotate: "-12deg" }],
  },
  waveBar: { width: IS_TV ? 10 : 6, borderRadius: 6, backgroundColor: "#FFFFFF" },
  iconBadge: {
    width: IS_TV ? 72 : 52,
    height: IS_TV ? 72 : 52,
    borderRadius: IS_TV ? 20 : 16,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
  cardText: { flex: 1, gap: IS_TV ? 8 : 6 },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 48 : 30,
    lineHeight: IS_TV ? 56 : 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: IS_TV ? 21 : 14,
    fontWeight: "500",
    lineHeight: IS_TV ? 28 : 20,
  },
  arrow: { width: IS_TV ? 52 : 40, height: IS_TV ? 52 : 40, borderRadius: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  arrowFocused: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  cardBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? 3 : 2,
    borderColor: "#FFFFFF",
    borderRadius: IS_TV ? 18 : 14,
  },
});
