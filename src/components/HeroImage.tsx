import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
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
      {imageUrl ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
  dimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
