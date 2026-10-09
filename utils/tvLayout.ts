import { Dimensions, Platform } from "react-native";

/** The Apple TV design uses a 1920-point canvas; Android TV uses density-independent pixels. */
export function tvSize(value: number): number {
  if (Platform.OS !== "android" || !Platform.isTV) return value;
  return value * (Dimensions.get("window").width / 1920);
}
