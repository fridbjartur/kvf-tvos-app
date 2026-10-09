import { Platform, type ScrollViewProps } from "react-native";
import { tvSize } from "@/utils/tvLayout";

const isAndroidTV = () => Platform.OS === "android" && Platform.isTV;

/**
 * Android TV focus scrolling, kept to a single native animation per key press.
 *
 * React Native's Android scroll views scroll focused children into view twice:
 * the platform's `arrowScroll` starts a smooth scroll, then React Native's
 * `requestChildFocus` jumps to the same child before that animation runs. The
 * animation then restarts from the old offset, which flashes. Each helper below
 * leaves exactly one of those paths active.
 */

/**
 * Horizontal shelves keep Android's own arrow-key scrolling: a smooth, minimal
 * scroll that reveals the next card, like UIKit's focus scrolling on tvOS.
 * Android keeps a revealed card one fading edge away from the screen edge, so
 * the edge doubles as the shelf's margin and leaves room for the focus scale.
 */
export function tvRowScrollProps(): Partial<ScrollViewProps> {
  return isAndroidTV() ? { scrollsChildToFocus: false, fadingEdgeLength: tvSize(60) } : {};
}

/**
 * Vertical screens snap the focused section to the top inset. Disabling user
 * scrolling stops `arrowScroll`, so focus moves through Android's focus search
 * and the scroll view animates once to the section marked with `tvSnap`. Programmatic
 * `scrollTo` still works.
 */
export function tvScreenScrollProps(topInset: number): Partial<ScrollViewProps> {
  return isAndroidTV() ? { scrollEnabled: false, snapToAlignment: "item", snapToItemPadding: topInset } : {};
}

/**
 * Marks a vertical section that snaps when it, or a child, gains focus:
 * - `start` aligns it to the top inset (shelves, page sections).
 * - `center` keeps a focused list row centered, scrolling one row per press.
 * - `end` scrolls only far enough to show its end, so content that fits stays put.
 *
 * The snap target must be a native view; plain Views are otherwise flattened away.
 */
export function tvSnap(align: "start" | "center" | "end" = "start") {
  return isAndroidTV() ? { scrollSnapAlign: align, collapsable: false } : {};
}
