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
import { Ionicons } from "@expo/vector-icons";
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
    icon: "radio",
    colors: ["#3B3B98", "#14142B"],
  },
  {
    section: "ljod-vit",
    title: strings.ljodPicker.vitTitle,
    subtitle: strings.ljodPicker.vitSubtitle,
    icon: "happy",
    colors: ["#C2185B", "#2E0A18"],
  },
];

function ChoiceCard({ choice, onPress }: { choice: Choice; onPress: (section: SectionId) => void }) {
  const handlePress = useCallback(() => onPress(choice.section), [onPress, choice.section]);

  return (
    <FocusScaleCard onPress={handlePress} scaleTo={1} cardStyle={S.card} borderStyle={S.cardBorder} accessibilityLabel={`${choice.title}. ${choice.subtitle}`}>
      <LinearGradient colors={choice.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.cardFill}>
        <Ionicons name={choice.icon} size={IS_TV ? 92 : 44} color="rgba(255,255,255,0.92)" />
        <View style={S.cardText}>
          <Text style={S.cardTitle}>{choice.title}</Text>
          <Text style={S.cardSubtitle}>{choice.subtitle}</Text>
        </View>
      </LinearGradient>
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
  container: { paddingTop: IS_TV ? 70 : 30, paddingBottom: IS_TV ? 80 : 30 },
  centered: { alignItems: "center", gap: IS_TV ? 64 : 32 },
  header: { alignItems: "center", gap: IS_TV ? 10 : 6 },
  heading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 56 : 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subheading: {
    color: "rgba(255,255,255,0.55)",
    fontSize: IS_TV ? 22 : 14,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    gap: IS_TV ? 72 : 24,
  },

  // No overflow:hidden on the card itself — the border must not be clipped as it scales.
  card: {
    width: IS_TV ? 520 : 165,
    height: IS_TV ? 380 : 190,
    borderRadius: IS_TV ? 22 : 14,
  },
  cardFill: {
    flex: 1,
    borderRadius: IS_TV ? 22 : 14,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: IS_TV ? 44 : 20,
  },
  cardText: { gap: IS_TV ? 8 : 4 },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 48 : 24,
    fontWeight: "800",
    letterSpacing: -1,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: IS_TV ? 21 : 12,
    fontWeight: "500",
    lineHeight: IS_TV ? 28 : 16,
  },
  cardBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? 4 : 2,
    borderColor: "#FFFFFF",
    borderRadius: IS_TV ? 22 : 14,
  },
});
