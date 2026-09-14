/**
 * ChannelTile — one live channel on the Beinleiðis screen.
 *
 * A channel with no stream URL yet renders as a disabled "coming soon" tile,
 * which the focus engine skips.
 */

import { FocusScaleCard } from "@/components/focus-scale-card";
import strings from "@/constants/strings.json";
import { LinearGradient } from "expo-linear-gradient";
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
      scaleTo={1.06}
      style={unavailable ? S.tileDisabled : undefined}
      cardStyle={S.tile}
      borderStyle={S.tileBorder}
      accessibilityLabel={`${name}${unavailable ? " (" + strings.schedule.comingSoon + ")" : ""}`}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.tileFill}>
        <View style={S.topRow}>{unavailable ? <Text style={S.comingSoon}>{strings.schedule.comingSoon}</Text> : <Text style={S.liveText}>{strings.schedule.liveTag}</Text>}</View>

        <View style={S.bottom}>
          <Text numberOfLines={1} style={S.channelName}>
            {name}
          </Text>
          <Text numberOfLines={1} style={S.channelSubtitle}>
            {nowPlayingTitle || subtitle}
          </Text>
        </View>
      </LinearGradient>
    </FocusScaleCard>
  );
}

const S = StyleSheet.create({
  // Card — no overflow:hidden so the border scales with the card and stays visible
  tile: {
    width: IS_TV ? 400 : 175,
    height: IS_TV ? 200 : 100,
    borderRadius: IS_TV ? 16 : 10,
  },
  tileFill: {
    flex: 1,
    borderRadius: IS_TV ? 16 : 10,
    overflow: "hidden",
    justifyContent: "space-between",
    paddingHorizontal: IS_TV ? 30 : 14,
    paddingVertical: IS_TV ? 22 : 10,
  },
  // White border — sits on top of the card content, not clipped
  tileBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? 4 : 2,
    borderColor: "#FFFFFF",
    borderRadius: IS_TV ? 16 : 10,
  },
  tileDisabled: {
    opacity: 0.45,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 13 : 9,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  comingSoon: {
    color: "rgba(255,255,255,0.7)",
    fontSize: IS_TV ? 13 : 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  bottom: {
    gap: IS_TV ? 4 : 2,
  },
  channelName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 40 : 22,
    fontWeight: "800",
    letterSpacing: -1,
  },
  channelSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: IS_TV ? 17 : 11,
    fontWeight: "500",
  },
});
