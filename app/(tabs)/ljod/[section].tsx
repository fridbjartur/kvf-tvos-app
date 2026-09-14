/**
 * One radio section's front page, pushed from the Ljóð picker.
 *
 * It lives on the tab's own stack, so the tab bar stays visible with Ljóð
 * selected and the remote's back button returns to the picker.
 */

import { useScreenBack } from "@/hooks/useScreenBack";
import { useCallback } from "react";
import { SectionScreen } from "@/components/section-screen";
import { isSectionId, SECTIONS } from "@/constants/sections";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function LjodSectionScreen() {
  const router = useRouter();
  useScreenBack(useCallback(() => router.dismissTo("/(tabs)/ljod"), [router]));
  const { section } = useLocalSearchParams<{ section: string }>();

  // Router params are strings. Anything that isn't one of radio's own sections
  // falls back to its root rather than showing TV content under the Ljóð tab.
  const safeSection = isSectionId(section) && SECTIONS[section].channel === "ljod" ? section : "ljod";

  return <SectionScreen section={safeSection} />;
}
