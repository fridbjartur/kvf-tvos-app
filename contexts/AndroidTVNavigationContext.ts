import { createContext, useContext } from "react";
import { Animated } from "react-native";
import { tvSize } from "@/utils/tvLayout";

export const ANDROID_TV_NAV_HEIGHT = 132;
const TAB_MOVE_WINDOW_MS = 150;

/** A tab screen's scroll view, registered while that screen is focused. */
export interface AndroidTVTabScreen {
  scrollToTop(animated: boolean): void;
}

/**
 * Couples Android TV's floating tab bar to the focused tab screen, as UIKit
 * couples tvOS's tab bar to the first scroll view.
 *
 * - The bar scrolls away with the content (`scrollY` drives it on the UI thread).
 * - Once scrolled away it leaves the focus order, so Up moves through the rows
 *   above instead of jumping to an off-screen tab.
 * - Focusing the bar (Up from the top, or Back from content) scrolls the screen
 *   to its top.
 */
export interface AndroidTVNavigation {
  /** Vertical content offset of the focused tab screen. */
  scrollY: Animated.Value;
  /** Registers the focused screen, at its last reported offset, and returns its cleanup. */
  activate(screen: AndroidTVTabScreen): () => void;
  /** JS-side offset reports, used to restore a screen's bar position and change its focusability. */
  reportOffset(screen: AndroidTVTabScreen, offsetY: number): void;
  /** Whether the bar has scrolled away with the content. */
  isScrolledAway(): boolean;
  /** Whether a tab in the bar currently has focus. */
  isBarFocused(): boolean;
  /**
   * Records a tab gaining focus. Returns true when focus moved along the bar,
   * and false when it arrived from content or from Android's focus recovery
   * (a focused view was removed, e.g. a pushed or popped screen).
   */
  tabFocused(): boolean;
  tabBlurred(): void;
  scrollToTop(animated?: boolean): void;
  /** Moves focus to the selected tab, revealing the bar first. */
  focusBar(): void;
  /** Subscribes to scrolled-away and focus-request changes. */
  subscribe(listener: () => void): () => void;
  /** Incremented by `focusBar`; the bar focuses its selected tab on change. */
  focusRequest(): number;
}

export function createAndroidTVNavigation(): AndroidTVNavigation {
  const scrollY = new Animated.Value(0);
  const listeners = new Set<() => void>();
  let active: AndroidTVTabScreen | null = null;
  const offsets = new WeakMap<AndroidTVTabScreen, number>();
  let scrolledAway = false;
  let barFocused = false;
  let barBlurredAt = -Infinity;
  // Set from Back until the bar has focus or the screen reaches its top, so
  // offsets reported during that scroll cannot remove the bar from focus.
  let revealing = false;
  let focusRequest = 0;

  const notify = () => listeners.forEach((listener) => listener());
  // Leave the focus order once the bar is mostly hidden.
  const updateScrolled = (offsetY: number) => {
    if (offsetY <= 0) revealing = false;
    if (revealing) return;
    const next = offsetY > tvSize(ANDROID_TV_NAV_HEIGHT) * 0.5;
    if (next === scrolledAway) return;
    scrolledAway = next;
    notify();
  };

  return {
    scrollY,
    activate(screen) {
      active = screen;
      let offsetY = offsets.get(screen) ?? 0;
      // Returning to the bar shows every tab from its top, as on tvOS.
      if (barFocused && offsetY !== 0) {
        screen.scrollToTop(false);
        offsetY = 0;
        offsets.set(screen, 0);
      }
      scrollY.setValue(offsetY);
      updateScrolled(offsetY);
      return () => {
        if (active !== screen) return;
        active = null;
        // Screens without a registered scroll view (Search) keep the bar visible.
        scrollY.setValue(0);
        updateScrolled(0);
      };
    },
    reportOffset(screen, offsetY) {
      offsets.set(screen, offsetY);
      if (screen === active) updateScrolled(offsetY);
    },
    isScrolledAway: () => scrolledAway,
    isBarFocused: () => barFocused,
    tabFocused() {
      // Android delivers the previous tab's blur just before the next focus.
      const movedAlongBar = barFocused || Date.now() - barBlurredAt < TAB_MOVE_WINDOW_MS;
      barFocused = true;
      revealing = false;
      return movedAlongBar;
    },
    tabBlurred() {
      barFocused = false;
      barBlurredAt = Date.now();
    },
    scrollToTop(animated = true) {
      active?.scrollToTop(animated);
    },
    focusBar() {
      revealing = true;
      scrolledAway = false;
      focusRequest += 1;
      notify();
      active?.scrollToTop(true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    focusRequest: () => focusRequest,
  };
}

/** Present only inside Android TV's tab navigator. */
export const AndroidTVNavigationContext = createContext<AndroidTVNavigation | null>(null);

export function useAndroidTVNavigation() {
  return useContext(AndroidTVNavigationContext);
}
