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
}

function useAiredFraction(entry: ScheduleEntry | null): number | null {
  return useMemo(() => {
    if (!entry?.endsAt) return null;
    const start = Date.parse(entry.startsAt);
    const end = Date.parse(entry.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
  }, [entry]);
}

export function NowPlayingCard({ entry, streamUrl, channelName, actionLabel, onPlay, hasTVPreferredFocus }: NowPlayingCardProps) {
  const aired = useAiredFraction(entry);

  const timeRange = entry ? [entry.startTime, entry.endTime].filter(Boolean).join(" – ") : null;

  const handlePlay = useCallback(() => {
    if (streamUrl) onPlay(channelName, streamUrl);
  }, [onPlay, channelName, streamUrl]);

  return (
    <TVFocusGuideView autoFocus style={S.card}>
      {entry?.thumbnailUrl ? (
        <Image source={{ uri: entry.thumbnailUrl, cacheKey: `live-${channelName}` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" priority="high" />
      ) : null}

      <LinearGradient colors={["rgba(10,10,10,0.25)", "rgba(10,10,10,0.96)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={S.content}>
        <View style={S.metaRow}>
          <Text style={S.liveTag}>{strings.schedule.liveTag}</Text>
          <Text style={S.channel}>{channelName}</Text>
          {timeRange ? <Text style={S.time}>{timeRange}</Text> : null}
        </View>

        <Text numberOfLines={1} style={S.title}>
          {entry?.title ?? strings.schedule.offAir}
        </Text>

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

        {streamUrl ? (
          <View style={S.actions}>
            <FocusableButton title={actionLabel} variant="primary" hasTVPreferredFocus={hasTVPreferredFocus} onPress={handlePlay} />
          </View>
        ) : null}
      </View>

      {aired !== null ? (
        <View style={S.progressTrack} pointerEvents="none">
          <View style={[S.progressFill, { width: `${Math.round(aired * 100)}%` }]} />
        </View>
      ) : null}
    </TVFocusGuideView>
  );
}

const S = StyleSheet.create({
  card: {
    height: IS_TV ? 420 : 230,
    borderRadius: IS_TV ? 18 : 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    justifyContent: "flex-end",
  },
  content: {
    padding: IS_TV ? 48 : 20,
    gap: IS_TV ? 10 : 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 18 : 10,
  },
  liveTag: {
    color: "#E8001C",
    fontSize: IS_TV ? 15 : 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  channel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: IS_TV ? 17 : 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  time: {
    color: "rgba(255,255,255,0.55)",
    fontSize: IS_TV ? 17 : 11,
    fontWeight: "500",
  },
  title: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 48 : 24,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: IS_TV ? 21 : 13,
    fontWeight: "500",
  },
  description: {
    color: "rgba(255,255,255,0.55)",
    fontSize: IS_TV ? 19 : 12,
    lineHeight: IS_TV ? 27 : 17,
    maxWidth: IS_TV ? "58%" : "100%",
  },
  actions: {
    flexDirection: "row",
    marginTop: IS_TV ? 16 : 10,
  },
  progressTrack: {
    height: IS_TV ? 6 : 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#E8001C",
  },
});
