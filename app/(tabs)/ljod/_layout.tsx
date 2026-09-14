/**
 * A stack *inside* the Ljóð tab.
 *
 * The picker pushes the chosen section onto this stack rather than the root
 * one, which is what keeps the native tab bar on screen with Ljóð still
 * selected — a push at the root would cover it.
 *
 * The category owns a focused Back/Menu handler; its native stack retains the
 * picker and its focus guide for restoration.
 */

import { Stack } from "expo-router";

export const unstable_settings = { anchor: "index" };

export default function LjodLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    />
  );
}
