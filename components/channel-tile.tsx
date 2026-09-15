/**
 * ChannelTile — one live channel on the Beinleiðis screen.
 *
 * A channel with no stream URL yet renders as a disabled "coming soon" tile,
 * which the focus engine skips.
 */

import { FocusScaleCard } from "@/components/focus-scale-card";
import strings from "@/constants/strings.json";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const IS_TV = Platform.isTV;

export interface LiveChannel {
  name: string;
  subtitle: string;
  url: string | null;
  /** Background wash, so the channels are told apart at a glance. */
  colors: readonly [string, string];
}

interface ChannelTileProps {
  channel: LiveChannel;
  /** What is on air now, when known. Falls back to the channel's own subtitle. */
  nowPlayingTitle?: string | null;
  onPress: (name: string, url: string) => void;
  hasTVPreferredFocus?: boolean;
}

export function ChannelTile({ channel, nowPlayingTitle, onPress, hasTVPreferredFocus }: ChannelTileProps) {
  const { name, subtitle, url, colors } = channel;
  const unavailable = !url;

  const handlePress = useCallback(() => {
    if (url) onPress(name, url);
  }, [name, url, onPress]);

  return (
    // scale wraps the whole card — no overflow:hidden so the border is never clipped
    <FocusScaleCard
      onPress={handlePress}
      activeOpacity={unavailable ? 1 : 0.9}
      isTVSelectable={!unavailable}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={unavailable}
      scaleTo={1.025}
      style={[S.slot, unavailable && S.tileDisabled]}
      cardStyle={S.tile}
      borderStyle={S.tileBorder}
      accessibilityLabel={`${name}. ${subtitle}${unavailable ? " (" + strings.schedule.comingSoon + ")" : ""}`}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.tileFill}>
        <View style={S.topRow}>
          <Text style={S.stationType}>{subtitle}</Text>
          {!unavailable ? <Ionicons name="play-circle-outline" size={IS_TV ? 28 : 22} color="rgba(255,255,255,0.8)" /> : null}
        </View>

        <View style={S.bottom}>
          <Text numberOfLines={1} style={S.channelName}>
            {name}
          </Text>
          <Text numberOfLines={1} style={S.channelSubtitle}>
            {nowPlayingTitle || (unavailable ? strings.schedule.comingSoon : strings.schedule.liveTag)}
          </Text>
        </View>
      </LinearGradient>
    </FocusScaleCard>
  );
}

const S = StyleSheet.create({
  slot: { flex: 1, minWidth: 0 },
  // Card — no overflow:hidden so the border scales with the card and stays visible
  tile: {
    flex: 1,
    minHeight: IS_TV ? 174 : 146,
    borderRadius: IS_TV ? 12 : 10,
  },
  tileFill: {
    flex: 1,
    borderRadius: IS_TV ? 12 : 10,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: IS_TV ? 24 : 16,
    gap: IS_TV ? 20 : 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  // White border — sits on top of the card content, not clipped
  tileBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? 3 : 2,
    borderColor: "#FFFFFF",
    borderRadius: IS_TV ? 12 : 10,
  },
  tileDisabled: {
    opacity: 0.45,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stationType: {
    color: "rgba(255,255,255,0.7)",
    fontSize: IS_TV ? 17 : 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  bottom: {
    gap: IS_TV ? 4 : 2,
  },
  channelName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 34 : 24,
    lineHeight: IS_TV ? 42 : 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
  channelSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: IS_TV ? 16 : 10,
    lineHeight: IS_TV ? 22 : 16,
    fontWeight: "500",
  },
});
