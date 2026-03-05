import { useEffect, useState } from "react";

type ColorScheme = "light" | "dark" | null;

/**
 * Web-specific color scheme hook using matchMedia
 * Uses the system preference and responds to changes in real-time
 * Handles hydration properly for SSR/SSG
 */
export function useColorScheme(): ColorScheme {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(null);

  useEffect(() => {
    setHasHydrated(true);

    // Check if matchMedia is available (browser environment)
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Set initial value
    setColorScheme(mediaQuery.matches ? "dark" : "light");

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? "dark" : "light");
    };

    // Modern browsers use addEventListener
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Before hydration, return 'light' as default (matches SSR)
  if (!hasHydrated) {
    return "light";
  }

  return colorScheme;
}
