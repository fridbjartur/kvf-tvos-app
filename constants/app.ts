/**
 * Shared application constants
 */

// Cache settings
export const CACHE = {
  /** Default TTL for cached data (5 minutes) */
  DEFAULT_TTL_MS: 5 * 60 * 1000,
} as const;

// Library grid sizing. Each grid picks ONE slot shape from the folder's dominant
// orientation (portrait poster grid vs landscape thumbnail grid), with the
// column count tuned per shape. Cards inside still render their own image in its
// native orientation.
export const GRID = {
  /** Portrait poster slot (width / height). */
  PORTRAIT_RATIO: 2 / 3,
  /** Landscape thumbnail slot (width / height). */
  LANDSCAPE_RATIO: 16 / 9,
  /** Columns for a portrait grid (TV / phone). */
  COLUMNS_PORTRAIT: { tv: 6, phone: 3 },
  /** Columns for a landscape grid (TV / phone) — wider cards, fewer columns. */
  COLUMNS_LANDSCAPE: { tv: 4, phone: 2 },
} as const;

export type SlotOrientation = "portrait" | "landscape";

/** Aspect ratio (w/h) for a slot orientation. */
export function slotRatio(orientation: SlotOrientation): number {
  return orientation === "landscape" ? GRID.LANDSCAPE_RATIO : GRID.PORTRAIT_RATIO;
}

/** Column count for a slot orientation on the current platform. */
export function slotColumns(orientation: SlotOrientation, isTV: boolean): number {
  const cols = orientation === "landscape" ? GRID.COLUMNS_LANDSCAPE : GRID.COLUMNS_PORTRAIT;
  return isTV ? cols.tv : cols.phone;
}

// Design system values
export const DESIGN = {
  /** Standard border radius for cards and grid items */
  BORDER_RADIUS_CARD: 32,
  /** Border radius for medium elements (settings rows, etc) */
  BORDER_RADIUS_MEDIUM: 12,
  /** Standard border radius for buttons */
  BORDER_RADIUS_BUTTON: 10,
  /** Standard border radius for inputs and small elements */
  BORDER_RADIUS_SMALL: 6,
  /** Fully circular elements */
  BORDER_RADIUS_ROUND: 999,
} as const;
