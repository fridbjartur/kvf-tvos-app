import { Platform, type HWEvent } from "react-native";

/**
 * True once per press of a remote button.
 *
 * Android TV reports a short D-pad press to JavaScript on release
 * (`eventKeyAction` 1); a held button arrives as `longLeft`, `longRight`, ….
 * Counting only the release also handles one press once where a device reports
 * both press and release. tvOS tap recognizers emit a single Ended event.
 */
export function isRemotePress(event: HWEvent, eventType: HWEvent["eventType"]): boolean {
  if (event.eventType !== eventType) return false;
  return Platform.OS !== "android" || event.eventKeyAction === 1;
}
