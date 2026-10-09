/**
 * One radio section's front page, pushed from the Ljóð picker.
 *
 * It lives on the tab's own stack, so the tab bar stays visible with Ljóð
 * selected and the remote's back button returns to the picker.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { useCallback } from "react";
import { Platform } from "react-native";
import { SectionScreen } from "@/components/section-screen";
import { isSectionId, SECTIONS } from "@/constants/sections";
import { StackActions } from "expo-router/react-navigation";
import { useLocalSearchParams, useNavigation } from "expo-router";

export default function LjodSectionScreen() {
  const navigation = useNavigation();
  // Pops this tab's own stack. A URL-based dismissTo is resolved from the root
  // and, under Android TV's JavaScript tabs, re-enters the tab navigator at Sjón.
  useScreenBack(useCallback(() => navigation.dispatch(StackActions.popTo("index")), [navigation]));
  const { section } = useLocalSearchParams<{ section: string }>();

  // Router params are strings. Anything that isn't one of radio's own sections
  // falls back to its root rather than showing TV content under the Ljóð tab.
  const safeSection = isSectionId(section) && SECTIONS[section].channel === "ljod" ? section : "ljod";

  return <SectionScreen section={safeSection} focusContentOnLoad={Platform.OS === "android" && Platform.isTV} />;
}
