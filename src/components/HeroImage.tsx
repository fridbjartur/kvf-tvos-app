import type { PropsWithChildren } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { palette, radii, spacing } from "../theme";

type HeroImageProps = PropsWithChildren<{
  imageUrl: string | null;
  height?: number;
  dimmer?: number;
}>;

export function HeroImage({
  imageUrl,
  height = 520,
  dimmer = 0.2,
  children,
}: HeroImageProps) {
  return (
    <View style={[styles.container, { height }]}>
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        imageStyle={styles.image}
        style={styles.background}
      >
        <View
          style={[styles.dimmer, { backgroundColor: `rgba(0,0,0,${dimmer})` }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(11,11,11,1)"]}
          style={styles.bottomFade}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: "hidden",
    marginTop: spacing.md,
    backgroundColor: palette.panelMuted,
  },
  background: {
    flex: 1,
    justifyContent: "flex-end",
  },
  image: {
    borderRadius: radii.lg,
  },
  dimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80%",
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
