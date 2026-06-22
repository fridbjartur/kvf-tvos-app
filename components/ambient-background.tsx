import { StyleSheet, View } from "react-native";

interface AmbientBackgroundProps {
  /** Base canvas color. Defaults to Netflix-style dark gray (OLED-safe, avoids pure black). */
  baseColor?: string;
  /** Glow tints. Default to a dim, neutral/cool pair so content stays the focus. */
  glows?: {
    top?: string;
    bottom?: string;
  };
}

const DEFAULT_BASE = "#141414";
const DEFAULT_GLOW_TOP = "rgba(120, 140, 170, 0.035)";
const DEFAULT_GLOW_BOTTOM = "rgba(120, 120, 130, 0.025)";

/**
 * Full-screen ambient background: a dark canvas with two large, very-low-opacity
 * soft glow circles offset off-screen at opposite corners. Rendered as an
 * absolute-fill layer behind screen content; never intercepts focus or touch.
 */
export function AmbientBackground({ baseColor = DEFAULT_BASE, glows }: AmbientBackgroundProps) {
  const topGlow = glows?.top ?? DEFAULT_GLOW_TOP;
  const bottomGlow = glows?.bottom ?? DEFAULT_GLOW_BOTTOM;

  return (
    <View pointerEvents="none" style={[styles.layer, { backgroundColor: baseColor }]}>
      <View style={[styles.glowTopRight, { backgroundColor: topGlow }]} />
      <View style={[styles.glowBottomLeft, { backgroundColor: bottomGlow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowTopRight: {
    position: "absolute",
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: 300,
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -300,
    left: -200,
    width: 700,
    height: 700,
    borderRadius: 350,
  },
});
