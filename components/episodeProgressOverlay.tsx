/**
 * Watch state drawn over an episode's artwork: a progress bar along the bottom
 * edge while it is part-watched, a Watched badge once it is finished.
 *
 * Shared by the program screen's episode cards and the Continue Watching row,
 * so both read the same at a glance. Purely decorative — never focusable.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { DESIGN } from "@/constants/app";
import strings from "@/constants/strings.json";
import { isInProgress, type EpisodeProgress } from "@/services/watchProgressService";

const IS_TV = Platform.isTV;

/** A just-started episode still shows a visible sliver. */
const MIN_FRACTION = 0.03;

/** Share of the runtime watched, or null when there is no runtime to measure against. */
export function watchedFraction(progress: EpisodeProgress): number | null {
  if (progress.duration <= 0) return null;
  return Math.min(1, Math.max(MIN_FRACTION, progress.position / progress.duration));
}

/** "12 min. eftir", or null when the runtime is unknown. */
export function formatMinutesLeft(progress: EpisodeProgress): string | null {
  if (progress.duration <= 0) return null;
  const minutes = Math.max(1, Math.round((progress.duration - progress.position) / 60));
  return strings.watch_progress.minutes_left.replace("{minutes}", String(minutes));
}

export function EpisodeProgressOverlay({ progress }: { progress: EpisodeProgress | undefined }) {
  if (progress?.completed) {
    return (
      <View style={S.badge} pointerEvents="none">
        <Ionicons name="checkmark" size={IS_TV ? 18 : 12} color="#000" />
        <Text style={S.badgeText}>{strings.watch_progress.watched_badge}</Text>
      </View>
    );
  }

  if (!isInProgress(progress)) return null;
  const fraction = watchedFraction(progress);
  if (fraction === null) return null;

  return (
    <View style={S.track} pointerEvents="none">
      <View style={[S.fill, { width: `${fraction * 100}%` }]} />
    </View>
  );
}

// Named "S" (not "styles") to prevent editor auto-import from shadowing this with an external module.
const S = StyleSheet.create({
  track: {
    position: "absolute",
    left: IS_TV ? 12 : 8,
    right: IS_TV ? 12 : 8,
    bottom: IS_TV ? 10 : 6,
    height: IS_TV ? 6 : 4,
    borderRadius: IS_TV ? 3 : 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#FFFFFF" },
  badge: {
    position: "absolute",
    top: IS_TV ? 12 : 8,
    right: IS_TV ? 12 : 8,
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 4 : 2,
    paddingHorizontal: IS_TV ? 10 : 6,
    paddingVertical: IS_TV ? 4 : 2,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  badgeText: { color: "#000", fontSize: IS_TV ? 14 : 10, fontWeight: "700" },
});
