import { useIsFocused } from "expo-router";
import { ScrollView, StyleSheet, TVFocusGuideView, type ScrollViewProps } from "react-native";

import { RefreshIndicator } from "@/components/refresh-indicator";

interface TVScreenScrollViewProps extends ScrollViewProps {
  /** Shows a passive top-right pip while a background revalidation runs. */
  isRefreshing?: boolean;
}

/**
 * Keep the vertical scroll view first in the native screen hierarchy so UIKit
 * can coordinate it with the tab bar. Headers belong inside this scroll view.
 * The guide remembers the last child without repeatedly requesting focus, and
 * excludes retained stack/tab screens from focus while they are inactive.
 *
 * The refresh pip is a *sibling* of the scroll view rather than a wrapper around
 * it, for two reasons: the scroll view has to stay first in the hierarchy, and
 * an indicator inside it would scroll away with the content instead of holding
 * its corner.
 */
export function TVScreenScrollView({ children, style, contentContainerStyle, isRefreshing = false, ...props }: TVScreenScrollViewProps) {
  const isFocused = useIsFocused();

  return (
    <>
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
      <RefreshIndicator active={isRefreshing} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { flexGrow: 1 },
});
