/**
 * NowPlayingCard — the banner at the top of Beinleiðis: what is on air right
 * now on the selected channel, and the button that starts watching it.
 *
 * The progress bar is computed once per payload rather than from a ticking
 * clock. A 30-second timer would re-render the whole screen 120 times an hour,
 * and on tvOS every unnecessary re-render throws D-pad focus — so the bar is
 * as fresh as the five-minute refresh that feeds it, and no fresher.
 */

import { FocusableButton } from "@/components/FocusableButton";
import { ShimmerBlock } from "@/components/shimmer-block";
import Ionicons from "@expo/vector-icons/Ionicons";
import strings from "@/constants/strings.json";
import type { ScheduleEntry } from "@/types/kvf";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo } from "react";
import { Platform, StyleSheet, Text, TVFocusGuideView, View } from "react-native";

const IS_TV = Platform.isTV;

interface NowPlayingCardProps {
  entry: ScheduleEntry | null;
  /** Live stream for the selected channel; null hides the play button. */
  streamUrl: string | null;
  channelName: string;
  /** "Watch" for TV, "listen" for radio. */
  actionLabel: string;
  onPlay: (name: string, url: string) => void;
  hasTVPreferredFocus?: boolean;
  isLoading?: boolean;
  isAudio?: boolean;
}

function useAiredFraction(entry: ScheduleEntry | null): number | null {
  return useMemo(() => {
    if (!entry?.endsAt) return null;
    const start = Date.parse(entry.startsAt);
    const end = Date.parse(entry.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    // Snapshot the clock with each new payload; a ticking effect is unnecessary.
    // eslint-disable-next-line react-hooks/purity
    return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
  }, [entry]);
}

export function NowPlayingCard({ entry, streamUrl, channelName, actionLabel, onPlay, hasTVPreferredFocus, isLoading = false, isAudio = false }: NowPlayingCardProps) {
  const aired = useAiredFraction(entry);

  const timeRange = entry ? [entry.startTime, entry.endTime].filter(Boolean).join(" – ") : null;

  const handlePlay = useCallback(() => {
    if (streamUrl) onPlay(channelName, streamUrl);
  }, [onPlay, channelName, streamUrl]);

  return (
    <TVFocusGuideView autoFocus style={S.card}>
      <LinearGradient colors={isAudio ? ["#30304F", "#13131C"] : ["#34323B", "#171419"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={S.channelArt} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={S.artRing}>
          <Ionicons name={isAudio ? "radio-outline" : "tv-outline"} size={IS_TV ? 100 : 72} color="rgba(255,255,255,0.12)" />
        </View>
      </View>
      {entry?.thumbnailUrl ? (
        <Image source={{ uri: entry.thumbnailUrl }} recyclingKey={entry.thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" priority="high" />
      ) : null}

      <LinearGradient
        colors={["rgba(10,10,10,0.88)", "rgba(10,10,10,0.48)", "rgba(10,10,10,0.08)"]}
        locations={[0, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient colors={["transparent", "rgba(10,10,10,0.65)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={S.content}>
        <View style={S.metaRow}>
          <View style={S.liveBadge}>
            <Text style={S.liveTag}>{strings.schedule.liveTag}</Text>
          </View>
          <Text style={S.channel}>{channelName}</Text>
        </View>

        {isLoading ? (
          <View style={S.loadingCopy} accessibilityLabel={strings.program.loadingButton} accessibilityState={{ busy: true }}>
            <ShimmerBlock style={S.skeletonTitle} />
            <ShimmerBlock style={S.skeletonLine} delayMs={100} />
          </View>
        ) : (
          <Text numberOfLines={2} style={S.title}>
            {entry?.title ?? strings.schedule.offAir}
          </Text>
        )}

        {entry?.subtitle ? (
          <Text numberOfLines={1} style={S.subtitle}>
            {entry.subtitle}
          </Text>
        ) : null}

        {entry?.description ? (
          <Text numberOfLines={2} style={S.description}>
            {entry.description}
          </Text>
        ) : null}

        {timeRange ? (
          <View style={S.timeline}>
            <Text style={S.time}>{timeRange}</Text>
            {aired !== null ? (
              <View style={S.progressTrack} accessibilityRole="progressbar" accessibilityLabel={entry?.title} accessibilityValue={{ min: 0, max: 100, now: Math.round(aired * 100) }}>
                <View style={[S.progressFill, { width: `${Math.round(aired * 100)}%` }]} />
              </View>
            ) : null}
          </View>
        ) : null}

        {streamUrl ? (
          <View style={S.actions}>
            <FocusableButton title={actionLabel} iconName="play" variant="primary" hasTVPreferredFocus={hasTVPreferredFocus} onPress={handlePlay} />
          </View>
        ) : null}
      </View>
    </TVFocusGuideView>
  );
}

const S = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: IS_TV ? 420 : 320,
    borderRadius: IS_TV ? 16 : 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  channelArt: { position: "absolute", top: -32, right: -24 },
  artRing: { width: IS_TV ? 340 : 240, height: IS_TV ? 340 : 240, borderRadius: 200, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  content: {
    padding: IS_TV ? 36 : 24,
    gap: IS_TV ? 12 : 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 14 : 10,
    flexWrap: "wrap",
  },
  liveBadge: { backgroundColor: "#CF1830", borderRadius: 4, paddingHorizontal: IS_TV ? 10 : 8, paddingVertical: 5 },
  liveTag: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 12 : 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  channel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: IS_TV ? 17 : 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  time: {
    color: "#BEBEC6",
    fontSize: IS_TV ? 17 : 11,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  title: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 42 : 28,
    lineHeight: IS_TV ? 50 : 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: IS_TV ? 21 : 13,
    fontWeight: "500",
  },
  description: {
    color: "#BEBEC6",
    fontSize: IS_TV ? 19 : 12,
    lineHeight: IS_TV ? 27 : 17,
    maxWidth: IS_TV ? 680 : "100%",
  },
  actions: {
    flexDirection: "row",
    marginTop: IS_TV ? 8 : 8,
  },
  timeline: { gap: 10, marginTop: 4, maxWidth: IS_TV ? 480 : 300 },
  loadingCopy: { gap: 12, paddingVertical: 8 },
  skeletonTitle: { width: "76%", height: IS_TV ? 40 : 30, borderRadius: 4 },
  skeletonLine: { width: "48%", height: IS_TV ? 20 : 14, borderRadius: 4 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#E8001C",
  },
});
