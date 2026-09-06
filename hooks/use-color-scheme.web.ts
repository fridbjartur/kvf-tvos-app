import { useSyncExternalStore } from "react";

type ColorScheme = "light" | "dark" | null;

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSnapshot(): ColorScheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return null;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// SSR/SSG renders 'light' — matches the pre-hydration default.
function getServerSnapshot(): ColorScheme {
  return "light";
}

/**
 * Web-specific color scheme hook using matchMedia
 * Uses the system preference and responds to changes in real-time
 * Handles hydration properly for SSR/SSG
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
