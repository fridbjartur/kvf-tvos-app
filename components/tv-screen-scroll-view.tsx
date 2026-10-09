import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, TVFocusGuideView, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from "react-native";
import { ANDROID_TV_NAV_HEIGHT, useAndroidTVNavigation, type AndroidTVTabScreen } from "@/contexts/AndroidTVNavigationContext";
import { tvSize } from "@/utils/tvLayout";
import { tvScreenScrollProps } from "@/utils/tvScroll";
import { createTVFocusMemory, TVFocusMemoryContext } from "@/contexts/TVFocusMemoryContext";

import { RefreshIndicator } from "@/components/refresh-indicator";

interface TVScreenScrollViewProps extends ScrollViewProps {
  /** Shows a passive top-right pip while a background revalidation runs. */
  isRefreshing?: boolean;
  /** Hero artwork extends behind the floating Android navigation. */
  underNavigation?: boolean;
}

/**
 * Keep the vertical scroll view first in the native screen hierarchy so UIKit
 * can coordinate it with the tab bar. Headers belong inside this scroll view.
 * The guide remembers the last child without repeatedly requesting focus, and
 * excludes retained stack/tab screens from focus while they are inactive.
 *
 * On Android TV the focused screen registers with the floating tab bar, which
 * scrolls away with this content and returns it to the top when focused, and
 * restores focus to the card that opened a detail screen (see TVFocusMemory).
 * Sections marked with `tvSnap` animate to the top inset as they gain focus.
 *
 * The refresh pip is a *sibling* of the scroll view rather than a wrapper around
 * it, for two reasons: the scroll view has to stay first in the hierarchy, and
 * an indicator inside it would scroll away with the content instead of holding
 * its corner.
 */
export function TVScreenScrollView({ children, style, contentContainerStyle, isRefreshing = false, underNavigation = false, ...props }: TVScreenScrollViewProps) {
  const isFocused = useIsFocused();
  const nav = useAndroidTVNavigation();
  const navigationHeight = nav ? tvSize(ANDROID_TV_NAV_HEIGHT) : 0;

  const scrollRef = useRef<ScrollView>(null);
  const [screen] = useState<AndroidTVTabScreen>(() => ({ scrollToTop: (animated) => scrollRef.current?.scrollTo({ y: 0, animated }) }));
  const [focusMemory] = useState(createTVFocusMemory);

  useFocusEffect(
    useCallback(() => {
      if (!nav) return;
      const deactivate = nav.activate(screen);
      const stopRestoring = focusMemory.restore();
      return () => {
        stopRestoring();
        focusMemory.leave();
        deactivate();
      };
    }, [nav, screen, focusMemory]),
  );

  const onScroll = useMemo(
    () =>
      nav
        ? Animated.event([{ nativeEvent: { contentOffset: { y: nav.scrollY } } }], {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => nav.reportOffset(screen, event.nativeEvent.contentOffset.y),
          })
        : undefined,
    [nav, screen],
  );

  const content = (
    // A fullscreen Android auto-focus guide overlaps the floating tabs and
    // prevents Down from reaching its children. Rows retain their own guides.
    <TVFocusGuideView autoFocus={!nav} focusable={isFocused} style={[styles.content, nav && !underNavigation && { paddingTop: navigationHeight }]}>
      {children}
    </TVFocusGuideView>
  );
  const scrollProps = {
    contentInsetAdjustmentBehavior: "automatic",
    showsVerticalScrollIndicator: false,
    removeClippedSubviews: false,
    ...props,
    style: [styles.screen, style],
    contentContainerStyle: [styles.content, contentContainerStyle],
  } satisfies ScrollViewProps;

  return (
    <TVFocusMemoryContext value={nav ? focusMemory : null}>
      {nav ? (
        <Animated.ScrollView ref={scrollRef} {...tvScreenScrollProps(navigationHeight)} scrollEventThrottle={16} onScroll={onScroll} {...scrollProps}>
          {content}
        </Animated.ScrollView>
      ) : (
        <ScrollView {...scrollProps}>{content}</ScrollView>
      )}
      <RefreshIndicator active={isRefreshing} />
    </TVFocusMemoryContext>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { flexGrow: 1 },
});
