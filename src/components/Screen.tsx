import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopBar } from "./TopBar";
import { palette, spacing } from "../theme";

type ScreenProps = PropsWithChildren<{
  showTopBar?: boolean;
}>;

export function Screen({ children, showTopBar = true }: ScreenProps) {
  return (
    <View style={styles.area}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showTopBar ? <TopBar /> : null}
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
    paddingBottom: spacing.sm,
  },
});
