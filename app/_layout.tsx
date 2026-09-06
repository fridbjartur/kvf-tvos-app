import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, LogBox } from "react-native";
import { useEffect } from "react";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { PosterBackdropProvider } from "@/contexts/PosterBackdropContext";
import { registerMultiAudioPlugin } from "@/services/multiAudioLoader";
import { loadApiUrl } from "@/services/kvfApi";
import { startKvfSync } from "@/services/kvfPreload";

if (Platform.isTV) {
  LogBox.ignoreAllLogs(true);
}

export default function RootLayout() {
  useEffect(() => {
    registerMultiAudioPlugin();

    let cancelled = false;
    let stop: (() => void) | undefined;

    // The saved base URL namespaces the cache, so it must be restored before
    // anything is read — otherwise the warm-up would miss every cached entry.
    loadApiUrl().then(() => {
      // Unmounting before this resolves must not leave the interval and the
      // AppState listener running with nothing to stop them.
      if (cancelled) return;
      stop = startKvfSync();
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <PlayQueueProvider>
          <PosterBackdropProvider>
            <Stack screenOptions={{ contentStyle: { backgroundColor: "#141414" } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="player"
                options={{
                  headerShown: false,
                  presentation: "fullScreenModal",
                  animation: "fade",
                }}
              />
              <Stack.Screen
                name="program"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                }}
              />
            </Stack>
            <StatusBar style="light" />
          </PosterBackdropProvider>
        </PlayQueueProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};
