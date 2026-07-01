/**
 * Live TV — KVF and KVF2 channel tiles.
 */

import strings from "@/constants/strings.json";
import { useLoading } from "@/contexts/LoadingContext";
import { useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IS_TV = Platform.isTV;
const SPRING = { tension: 220, friction: 22, useNativeDriver: true } as const;

const CHANNELS: { name: string; subtitle: string; url: string | null }[] = [
  {
    name: "KVF",
    subtitle: "Sjón",
    url: "https://w-live-edge1.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8",
  },
  {
    name: "KVF 2",
    subtitle: "Sjón 2",
    url: "https://w-live-edge1.kringvarp.fo/kvf-2/_definst_/smil:kvf-2.smil/playlist.m3u8",
  },
];

interface ChannelTileProps {
  name: string;
  subtitle: string;
  url: string | null;
  onPress: (name: string, url: string) => void;
  hasTVPreferredFocus?: boolean;
}

function ChannelTile({ name, subtitle, url, onPress, hasTVPreferredFocus }: ChannelTileProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const unavailable = !url;

  const handleFocus = useCallback(() => {
    Animated.spring(scale, { toValue: 1.07, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 1, ...SPRING }).start();
  }, [scale, borderOpacity]);

  const handleBlur = useCallback(() => {
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 0, ...SPRING }).start();
  }, [scale, borderOpacity]);

  const handlePress = useCallback(() => {
    if (url) onPress(name, url);
  }, [name, url, onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={unavailable ? 1 : 0.9}
      isTVSelectable={!unavailable}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={unavailable}
      style={unavailable && S.tileDisabled}
      accessibilityLabel={`${name}${unavailable ? " (" + strings.live.comingSoon + ")" : ""}`}
      accessibilityRole="button">
      {/* scale wraps the whole card — no overflow:hidden so border is never clipped */}
      <Animated.View style={[S.tile, { transform: [{ scale }] }]}>
        <View style={S.tileInner}>
          {!unavailable && (
            <View style={S.liveBadge}>
              <Text style={S.liveText}>{strings.live.liveTag}</Text>
            </View>
          )}
          <Text style={[S.channelName, unavailable && S.channelNameDisabled]}>{name}</Text>
          <Text style={[S.channelSubtitle, unavailable && S.channelNameDisabled]}>{subtitle}</Text>
          {unavailable && <Text style={S.comingSoon}>{strings.live.comingSoon}</Text>}
        </View>

        {/* White focus border — absolutely positioned, not clipped */}
        <Animated.View style={[S.tileBorder, { opacity: borderOpacity }]} pointerEvents="none" />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function LiveTvScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const insets = useSafeAreaInsets();

  const handleChannelPress = useCallback(
    (name: string, url: string) => {
      showGlobalLoader();
      router.push({ pathname: "/player", params: { streamUrl: url, title: name, isLive: "true" } });
    },
    [router, showGlobalLoader],
  );

  return (
    <View style={S.container}>
      {/* Spacer so content sits below the NativeTabs bar */}
      <View style={{ height: insets.top }} />
      <View style={S.centered}>
        <Text style={S.heading}>{strings.live.heading}</Text>
        <View style={S.grid}>
          {CHANNELS.map((ch, i) => (
            <ChannelTile key={ch.name} name={ch.name} subtitle={ch.subtitle} url={ch.url} onPress={handleChannelPress} hasTVPreferredFocus={i === 0} />
          ))}
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    backgroundColor: "#0a0a0a",
  },
  // Fills the space below the tab bar and centers content in it
  centered: {
    justifyContent: "center",
    alignItems: "center",
    gap: IS_TV ? 40 : 24,
  },
  heading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 32 : 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: "row",
    gap: IS_TV ? 100 : 20,
  },

  // Card — no overflow:hidden so the border scales with the card and stays visible
  tile: {
    width: IS_TV ? 380 : 170,
    height: IS_TV ? 220 : 110,
    backgroundColor: "#1C1C1E",
    borderRadius: IS_TV ? 14 : 10,
  },
  accentBar: {
    height: IS_TV ? 4 : 3,
    backgroundColor: "#E8001C",
    borderTopLeftRadius: IS_TV ? 14 : 10,
    borderTopRightRadius: IS_TV ? 14 : 10,
  },
  tileInner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: IS_TV ? 28 : 16,
    paddingVertical: IS_TV ? 16 : 10,
    gap: IS_TV ? 4 : 2,
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
    borderRadius: IS_TV ? 14 : 10,
  },
  tileDisabled: {
    opacity: 0.4,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 6 : 4,
    marginBottom: IS_TV ? 4 : 2,
  },
  liveDot: {
    width: IS_TV ? 8 : 6,
    height: IS_TV ? 8 : 6,
    borderRadius: 4,
    backgroundColor: "#E8001C",
  },
  liveText: {
    color: "#E8001C",
    fontSize: IS_TV ? 12 : 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  channelName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 44 : 26,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: IS_TV ? 48 : 30,
  },
  channelSubtitle: {
    color: "#636366",
    fontSize: IS_TV ? 15 : 11,
    fontWeight: "500",
  },
  channelNameDisabled: { color: "#48484A" },
  comingSoon: {
    color: "#48484A",
    fontSize: IS_TV ? 13 : 10,
    fontWeight: "500",
    marginTop: IS_TV ? 4 : 2,
  },
});
