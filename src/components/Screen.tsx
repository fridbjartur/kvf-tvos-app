import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { spacing } from "../theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <View style={styles.area}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
  },
});
