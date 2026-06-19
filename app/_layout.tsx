import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, LogBox } from "react-native";
import { useEffect } from "react";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LibraryProvider } from "@/contexts/LibraryContext";
import { FolderNavigationProvider } from "@/contexts/FolderNavigationContext";
import { PlayQueueProvider } from "@/contexts/PlayQueueContext";
import { registerMultiAudioPlugin } from "@/services/multiAudioLoader";
import { syncDevCredentials } from "@/services/jellyfinApi";

// Suppress yellow box warnings on TV platforms
if (Platform.isTV) {
  LogBox.ignoreAllLogs(true);
}

export default function RootLayout() {
  // Register plugins and sync credentials on app startup
  useEffect(() => {
    registerMultiAudioPlugin();
    syncDevCredentials();
  }, []);

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <LibraryProvider>
          <FolderNavigationProvider>
            <PlayQueueProvider>
              <Stack screenOptions={{ contentStyle: { backgroundColor: "#3d3d3d" } }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="player"
                  options={{
                    headerShown: false,
                    presentation: "fullScreenModal",
                    animation: "fade",
                  }}
                />
              </Stack>
              <StatusBar style="light" />
            </PlayQueueProvider>
          </FolderNavigationProvider>
        </LibraryProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};
