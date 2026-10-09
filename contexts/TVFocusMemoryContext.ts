import { createContext, useContext } from "react";
import type { View } from "react-native";

/**
 * Restores focus to the card that opened a detail screen, as tvOS's focus
 * engine does when a screen is uncovered.
 *
 * Android TV loses it: the covered screen's focused card is detached, and when
 * the screen returns Android recovers focus to the top-left element (the hero
 * or the tab bar). React Native Screens only restores focus that its fragment
 * still held when stopped, which a fast pushed screen has already taken.
 *
 * `TVScreenScrollView` owns one memory per screen. Focus targets report focus
 * and blur; when the screen loses navigation focus it keeps the focused target,
 * and when it regains it requests that target's focus until it reports focus.
 * A screen left from the tab bar has no focused target, so selecting its tab
 * again leaves focus on the bar.
 */
export interface TVFocusMemory {
  focused(view: View): void;
  blurred(view: View): void;
  /** The screen was covered or left. */
  leave(): void;
  /** The screen is focused again. Returns a cleanup that stops pending attempts. */
  restore(): () => void;
}

/**
 * The returning screen re-attaches during the pop transition, at no fixed point
 * relative to JavaScript, so focus is requested on the next frame and again
 * until the target reports it.
 */
const RESTORE_ATTEMPTS_MS = [50, 150, 300];

export function createTVFocusMemory(): TVFocusMemory {
  let current: View | null = null;
  let pending: View | null = null;

  return {
    focused(view) {
      current = view;
      if (view === pending) pending = null;
    },
    blurred(view) {
      if (current === view) current = null;
    },
    leave() {
      pending = current;
    },
    restore() {
      const view = pending;
      if (!view) return () => {};
      const attempt = () => {
        if (pending === view) view.requestTVFocus();
      };
      const frame = requestAnimationFrame(attempt);
      const timers = RESTORE_ATTEMPTS_MS.map((delay) => setTimeout(attempt, delay));
      const giveUp = setTimeout(
        () => {
          if (pending === view) pending = null;
        },
        RESTORE_ATTEMPTS_MS.at(-1)! + 1,
      );
      return () => {
        cancelAnimationFrame(frame);
        timers.forEach(clearTimeout);
        clearTimeout(giveUp);
      };
    },
  };
}

/** Present only inside an Android TV tab screen's `TVScreenScrollView`. */
export const TVFocusMemoryContext = createContext<TVFocusMemory | null>(null);

export function useTVFocusMemory() {
  return useContext(TVFocusMemoryContext);
}
