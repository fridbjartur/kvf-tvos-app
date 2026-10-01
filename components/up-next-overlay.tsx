/**
 * Up Next for the episode player.
 *
 * On tvOS the native AVPlayerViewController owns remote focus, so React views
 * drawn over it can never be selected. There the "Næsta sending" button is added
 * to the player's own transport bar (see modules/kvf-up-next). It sits in the row
 * above the scrubber, and up/down move between them as usual. This component draws
 * a passive card with the artwork and countdown that never takes focus.
 *
 * Elsewhere, or if no native player controller is found, the card carries its own
 * button instead.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { DESIGN } from "@/constants/app";
import strings from "@/constants/strings.json";
import NativeUpNext from "@/modules/kvf-up-next";

interface UpNextOverlayProps {
  visible: boolean;
  title: string;
  imageUrl: string | null;
  /** Whole seconds until the current episode ends. */
  secondsRemaining: number;
  /** Length of the countdown, used to fill the progress bar. */
  leadSeconds: number;
  onSelect: () => void;
}

const TV = Platform.isTV;

export function formatUpNextCountdown(seconds: number) {
  return strings.player.upNextCountdown.replace("{seconds}", String(Math.max(0, Math.ceil(seconds))));
}

export function UpNextOverlay({ visible, title, imageUrl, secondsRemaining, leadSeconds, onSelect }: UpNextOverlayProps) {
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Each appearance gets a new id so a late answer from an earlier `show` is ignored.
  const [showCount, setShowCount] = useState(0);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setShowCount((count) => count + 1);
  }
  const [nativeResult, setNativeResult] = useState<{ id: number; shown: boolean } | null>(null);
  // Until native answers, assume the transport bar has the button.
  const ownButton = !NativeUpNext || (nativeResult?.id === showCount && !nativeResult.shown);

  useEffect(() => {
    if (!visible || !NativeUpNext) return;
    const native = NativeUpNext;
    let current = true;
    const subscription = native.addListener("onSelect", () => {
      if (current) onSelectRef.current();
    });
    native
      .show(strings.player.upNextHeading)
      .catch(() => false)
      .then((shown) => {
        if (current) setNativeResult({ id: showCount, shown });
      });
    return () => {
      current = false;
      subscription.remove();
      native.hide().catch(() => {});
    };
  }, [visible, showCount]);

  if (!visible) return null;

  const countdown = formatUpNextCountdown(secondsRemaining);
  const elapsed = leadSeconds > 0 ? 1 - Math.max(0, Math.min(1, secondsRemaining / leadSeconds)) : 0;
  return <UpNextCard title={title} imageUrl={imageUrl} countdown={countdown} elapsed={elapsed} onSelect={ownButton ? onSelect : null} />;
}

/** `onSelect` is null when the native transport bar provides the button. */
function UpNextCard({ title, imageUrl, countdown, elapsed, onSelect }: { title: string; imageUrl: string | null; countdown: string; elapsed: number; onSelect: (() => void) | null }) {
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(appear, { toValue: 1, duration: 260, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [appear]);

  const translateX = appear.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Animated.View style={[styles.container, { opacity: appear, transform: [{ translateX }] }]} pointerEvents={onSelect ? "box-none" : "none"}>
      <View style={styles.card}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumbnail} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="tv-outline" size={TV ? 40 : 28} color="rgba(255,255,255,0.4)" />
          </View>
        )}

        <View style={styles.details}>
          <Text style={styles.heading}>{strings.player.upNextHeading}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {onSelect ? (
            <Pressable onPress={onSelect} hasTVPreferredFocus accessibilityRole="button" accessibilityLabel={`${strings.player.upNextAction}: ${title}`} accessibilityHint={countdown}>
              {({ focused, pressed }) => (
                <View style={[styles.button, focused && styles.buttonFocused, pressed && styles.buttonPressed]}>
                  <Ionicons name="play" size={TV ? 24 : 16} color={focused ? "#000" : "#FFF"} />
                  <Text style={[styles.buttonText, focused && styles.buttonTextFocused]}>{strings.player.upNextAction}</Text>
                </View>
              )}
            </Pressable>
          ) : null}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${elapsed * 100}%` }]} />
          </View>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bottom right, high enough to clear the transport bar and its button row when the controls are up.
  container: {
    position: "absolute",
    bottom: TV ? 300 : 100,
    right: TV ? 80 : 20,
    zIndex: 200,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: TV ? 24 : 14,
    padding: TV ? 18 : 12,
    borderRadius: TV ? 18 : 12,
    backgroundColor: "rgba(20, 20, 22, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  thumbnail: {
    width: TV ? 256 : 128,
    aspectRatio: 16 / 9,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    backgroundColor: "#2C2C2E",
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    width: TV ? 340 : 170,
    gap: TV ? 8 : 4,
  },
  heading: {
    fontSize: TV ? 20 : 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "rgba(255, 255, 255, 0.6)",
    textTransform: "uppercase",
  },
  title: {
    fontSize: TV ? 30 : 16,
    lineHeight: TV ? 36 : 20,
    fontWeight: "700",
    color: "#FFF",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: TV ? 10 : 6,
    paddingHorizontal: TV ? 24 : 14,
    paddingVertical: TV ? 12 : 8,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  buttonFocused: {
    backgroundColor: "#FFF",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: TV ? 22 : 14,
    fontWeight: "700",
    color: "#FFF",
  },
  buttonTextFocused: {
    color: "#000",
  },
  progressTrack: {
    height: 4,
    marginTop: TV ? 4 : 2,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFF",
  },
  countdown: {
    fontSize: TV ? 20 : 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    color: "rgba(255, 255, 255, 0.6)",
  },
});
