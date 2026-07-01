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

if (Platform.isTV) {
  LogBox.ignoreAllLogs(true);
}

export default function RootLayout() {
  useEffect(() => {
    registerMultiAudioPlugin();
    loadApiUrl(); // restore saved API URL from secure store
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
