import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { spacing } from "../theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: "100%",
    paddingVertical: spacing.sm,
  },
});
