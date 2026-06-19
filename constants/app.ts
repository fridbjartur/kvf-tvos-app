/**
 * Shared application constants
 */

// Cache settings
export const CACHE = {
  /** Default TTL for cached data (5 minutes) */
  DEFAULT_TTL_MS: 5 * 60 * 1000,
} as const;

// Library grid sizing
export const GRID = {
  /** Card aspect ratio (width / height) = 8:9, so a 16:9 landscape image fills
   *  the top half and the always-visible info panel fills the bottom half. */
  CARD_ASPECT_RATIO: 8 / 9,
} as const;

// Design system values
export const DESIGN = {
  /** Standard border radius for cards and grid items */
  BORDER_RADIUS_CARD: 32,
  /** Border radius for medium elements (settings rows, etc) */
  BORDER_RADIUS_MEDIUM: 12,
  /** Standard border radius for buttons */
  BORDER_RADIUS_BUTTON: 10,
  /** Standard border radius for inputs and small elements */
  BORDER_RADIUS_SMALL: 8,
  /** Fully circular elements */
  BORDER_RADIUS_ROUND: 999,
} as const;
