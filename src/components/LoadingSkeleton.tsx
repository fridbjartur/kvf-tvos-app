import { StyleSheet, View } from "react-native";
import { palette, radii, spacing } from "../theme";

export function LoadingSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.hero} />
      <View style={styles.railTitle} />
      <View style={styles.row}>
        <View style={styles.card} />
        <View style={styles.card} />
        <View style={styles.card} />
      </View>
      <View style={styles.railTitle} />
      <View style={styles.row}>
        <View style={styles.card} />
        <View style={styles.card} />
        <View style={styles.card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingTop: spacing.sm
  },
  hero: {
    height: 360,
    borderRadius: radii.lg,
    backgroundColor: palette.panel
  },
  railTitle: {
    width: 180,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: palette.panelMuted
  },
  row: {
    flexDirection: "row",
    gap: spacing.md
  },
  card: {
    width: 240,
    height: 140,
    borderRadius: radii.md,
    backgroundColor: palette.panel
  }
});
