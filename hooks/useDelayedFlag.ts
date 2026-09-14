/**
 * Smooths a fast-flipping boolean for display.
 *
 * Most revalidations settle in well under a second — a conditional request that
 * comes back 304 is the common case — so binding an indicator straight to
 * `isRefreshing` would flash it on and off again, which reads as a glitch rather
 * than as progress. This holds the flag low until the work has been running for
 * `delayMs`, then holds it high for at least `minVisibleMs` once shown.
 */

import { useEffect, useRef, useState } from "react";

/** Long enough that a 304 never shows anything, short enough to feel immediate. */
const DEFAULT_DELAY_MS = 400;

/** Once it is on screen it must stay long enough to be read as intentional. */
const DEFAULT_MIN_VISIBLE_MS = 700;

export function useDelayedFlag(active: boolean, delayMs = DEFAULT_DELAY_MS, minVisibleMs = DEFAULT_MIN_VISIBLE_MS): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    // Already settled in the direction we want — nothing to schedule.
    if (active === visible) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
    } else {
      const remaining = minVisibleMs - (Date.now() - shownAt.current);
      if (remaining <= 0) setVisible(false);
      else timer = setTimeout(() => setVisible(false), remaining);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [active, visible, delayMs, minVisibleMs]);

  return visible;
}
