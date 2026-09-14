import { useIsFocused } from "expo-router";
import { ScrollView, StyleSheet, TVFocusGuideView, type ScrollViewProps } from "react-native";

/**
 * Keep the vertical scroll view first in the native screen hierarchy so UIKit
 * can coordinate it with the tab bar. Headers belong inside this scroll view.
 * The guide remembers the last child without repeatedly requesting focus, and
 * excludes retained stack/tab screens from focus while they are inactive.
 */
export function TVScreenScrollView({ children, style, contentContainerStyle, ...props }: ScrollViewProps) {
  const isFocused = useIsFocused();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
      {...props}
      style={[styles.screen, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}>
      <TVFocusGuideView autoFocus focusable={isFocused} style={styles.content}>
        {children}
      </TVFocusGuideView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { flexGrow: 1 },
});
