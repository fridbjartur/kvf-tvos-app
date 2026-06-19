import { ConnectedSection } from "@/components/settings/ConnectedSection";
import { NotConnectedSection } from "@/components/settings/NotConnectedSection";
import { QuickConnectSection } from "@/components/settings/QuickConnectSection";
import { settingsStyles as styles } from "@/components/settings/styles";
import { UsernamePasswordSection } from "@/components/settings/UsernamePasswordSection";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLibrary } from "@/contexts/LibraryContext";
import {
  authenticateByName,
  checkQuickConnectEnabled,
  connectToDemoServer,
  evaluateSavedConnection,
  getStoredServerName,
  resolveServerConnection,
  restoreLastConnection,
  saveAuthResult,
  signOut,
} from "@/services/jellyfinApi";
import { useQuickConnect } from "@/hooks/useQuickConnect";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const STORAGE_KEYS = {
  SERVER_URL: "jellyfin_server_url",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality",
};

const QUALITY_PRESETS = [
  { label: "480p", value: 0, description: "Fast - Lower" },
  { label: "540p", value: 1, description: "Balanced - Good" },
  { label: "720p", value: 2, description: "Smooth - High" },
  { label: "1080p", value: 3, description: "Best - Highest" },
  { label: "4K", value: 4, description: "Ultra - Maximum" },
];

type ScreenState = "LOADING" | "NOT_CONNECTED" | "QUICK_CONNECT" | "USERNAME_PASSWORD" | "CONNECTED";

export default function SettingsScreen() {
  const { refreshLibrary } = useLibrary();
  const { refresh: refreshFolderNavigation } = useFolderNavigation();

  const [screenState, setScreenState] = useState<ScreenState>("LOADING");
  const [serverUrl, setServerUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [serverName, setServerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [connectedServerName, setConnectedServerName] = useState("");
  const [connectedServerUrl, setConnectedServerUrl] = useState("");
  const [videoQuality, setVideoQuality] = useState(2);
  const [isConnectingDemo, setIsConnectingDemo] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastConnection, setLastConnection] = useState<{ url: string; serverName: string } | null>(null);

  const quickConnect = useQuickConnect();
  const serverUrlRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const loadCurrentState = async () => {
    try {
      const [savedUrl, savedKey, savedUserId, savedQuality, savedServerName] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
        getStoredServerName(),
      ]);

      if (savedQuality) setVideoQuality(parseInt(savedQuality, 10));

      if (savedUrl && savedKey && savedUserId) {
        setConnectedServerName(savedServerName || savedUrl);
        setConnectedServerUrl(savedUrl || "");
        setLastConnection({ url: savedUrl, serverName: savedServerName || savedUrl });

        // Auto-try once per launch: only stay connected if the saved server is
        // actually reachable. If the IP/address changed, drop to the connect
        // screen so the user can restore (auto-discovery) or enter a new address.
        const status = await evaluateSavedConnection();
        setScreenState(status === "connected" ? "CONNECTED" : "NOT_CONNECTED");
      } else {
        setLastConnection(null);
        setScreenState("NOT_CONNECTED");
      }
    } catch (error) {
      logger.error("Error loading settings state", error);
      setScreenState("NOT_CONNECTED");
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCurrentState();
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  React.useEffect(() => {
    if (quickConnect.status === "AUTHENTICATED" && quickConnect.authResult) {
      refreshLibrary();
      refreshFolderNavigation();
      // loadCurrentState sets state only after awaited I/O (not a synchronous cascade)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCurrentState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickConnect.status]);

  const handleConnectServer = async () => {
    const trimmed = serverUrl.trim();
    if (!trimmed) {
      Alert.alert("Missing Address", "Please enter your Jellyfin server IP, hostname, or URL.");
      return;
    }

    setIsValidating(true);
    try {
      // Accepts a bare IP/hostname (auto-discovers protocol + port) or a full URL.
      const { url: resolvedUrl, info } = await resolveServerConnection(trimmed);
      setServerUrl(resolvedUrl);
      setServerName(info.ServerName);

      const quickConnectEnabled = await checkQuickConnectEnabled(resolvedUrl);
      if (quickConnectEnabled) {
        quickConnect.initiate(resolvedUrl, info.ServerName);
        setScreenState("QUICK_CONNECT");
      } else {
        setScreenState("USERNAME_PASSWORD");
      }
    } catch (error) {
      Alert.alert("Connection Failed", error instanceof Error ? error.message : "Unable to connect to server.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRestoreConnection = async () => {
    setIsRestoring(true);
    try {
      const { serverName } = await restoreLastConnection();
      setServerName(serverName);
      await refreshLibrary();
      await refreshFolderNavigation();
      await loadCurrentState();
    } catch (error) {
      Alert.alert("Couldn't Restore", error instanceof Error ? error.message : "Unable to reach your last server.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignIn = async () => {
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      Alert.alert("Missing Username", "Please enter your username.");
      return;
    }

    setIsSigningIn(true);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
      const auth = await authenticateByName(cleanUrl, trimmedUser, password);
      await saveAuthResult(cleanUrl, auth.AccessToken, auth.User.Id, auth.User.Name, serverName, "password");
      await refreshLibrary();
      await refreshFolderNavigation();
      await loadCurrentState();
    } catch (error) {
      Alert.alert("Sign In Failed", error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleConnectDemo = async () => {
    setIsConnectingDemo(true);
    try {
      await connectToDemoServer();
      await refreshLibrary();
      await refreshFolderNavigation();
      await loadCurrentState();
    } catch (error) {
      Alert.alert("Demo Connection Failed", error instanceof Error ? error.message : "Unable to connect to demo server.");
    } finally {
      setIsConnectingDemo(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            setServerUrl("");
            setUsername("");
            setPassword("");
            setServerName("");
            setScreenState("NOT_CONNECTED");
            refreshLibrary();
            refreshFolderNavigation();
          } catch (error) {
            logger.error("Error signing out", error);
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  };

  const handleQualityChange = async (qualityValue: number) => {
    try {
      setVideoQuality(qualityValue);
      await SecureStore.setItemAsync(STORAGE_KEYS.VIDEO_QUALITY, qualityValue.toString());
      Alert.alert("Success", `Video quality set to ${QUALITY_PRESETS[qualityValue]?.label || "Unknown"}`);
    } catch (error) {
      logger.error("Error saving video quality", error);
      Alert.alert("Error", "Failed to save video quality");
    }
  };

  const switchToUsernamePassword = () => {
    quickConnect.cancel();
    setScreenState("USERNAME_PASSWORD");
  };

  const switchToQuickConnect = () => {
    setUsername("");
    setPassword("");
    quickConnect.initiate(serverUrl.trim(), serverName);
    setScreenState("QUICK_CONNECT");
  };

  const goBackToServerUrl = () => {
    quickConnect.cancel();
    setUsername("");
    setPassword("");
    setScreenState("NOT_CONNECTED");
  };

  if (screenState === "LOADING") {
    return (
      <View style={screenStyles.container}>
        <View style={screenStyles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={screenStyles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <ScrollView
        style={screenStyles.scrollView}
        contentContainerStyle={screenStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        focusable={false}>
        <View style={screenStyles.contentContainer}>
          <View style={screenStyles.sectionHeader}>
            <Text style={screenStyles.sectionHeaderText}>JELLYFIN SERVER</Text>
          </View>

          {screenState === "NOT_CONNECTED" && (
            <NotConnectedSection
              serverUrl={serverUrl}
              setServerUrl={setServerUrl}
              serverUrlRef={serverUrlRef}
              isValidating={isValidating}
              isConnectingDemo={isConnectingDemo}
              onConnect={handleConnectServer}
              onConnectDemo={handleConnectDemo}
              lastConnection={lastConnection}
              isRestoring={isRestoring}
              onRestore={handleRestoreConnection}
            />
          )}

          {screenState === "QUICK_CONNECT" && (
            <QuickConnectSection code={quickConnect.code} status={quickConnect.status} error={quickConnect.error} onCancel={goBackToServerUrl} onSwitchToPassword={switchToUsernamePassword} />
          )}

          {screenState === "USERNAME_PASSWORD" && (
            <UsernamePasswordSection
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              usernameRef={usernameRef}
              passwordRef={passwordRef}
              isSigningIn={isSigningIn}
              onSignIn={handleSignIn}
              onBack={goBackToServerUrl}
              onSwitchToQuickConnect={switchToQuickConnect}
              serverName={serverName}
            />
          )}

          {screenState === "CONNECTED" && <ConnectedSection serverName={connectedServerName} serverUrl={connectedServerUrl} onSignOut={handleSignOut} />}

          {screenState === "CONNECTED" && (
            <>
              <View style={screenStyles.sectionHeader}>
                <Text style={screenStyles.sectionHeaderText}>VIDEO QUALITY</Text>
              </View>

              <View style={styles.section}>
                {QUALITY_PRESETS.map((preset, index) => (
                  <Pressable
                    key={preset.value}
                    style={({ focused }) => [
                      styles.listItem,
                      index === 0 && styles.listItemFirst,
                      index === QUALITY_PRESETS.length - 1 && styles.listItemLast,
                      focused && { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                    ]}
                    onPress={() => handleQualityChange(preset.value)}
                    tvParallaxProperties={{ magnification: 1.01 }}
                    isTVSelectable={true}
                    accessibilityLabel={`${preset.label} quality`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: videoQuality === preset.value }}
                    accessibilityHint={`Set video quality to ${preset.label}. ${preset.description}`}>
                    <View style={styles.listItemContent}>
                      <View style={styles.listItemLeft}>
                        <Text style={styles.listItemTitle}>{preset.label}</Text>
                        <Text style={styles.listItemSubtitle}>{preset.description}</Text>
                      </View>
                      {videoQuality === preset.value && <Ionicons name="checkmark" size={Platform.isTV ? 28 : 24} color="#FFC312" />}
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.isTV ? 20 : 16,
    paddingBottom: Platform.isTV ? 60 : 40,
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 600,
    paddingHorizontal: Platform.isTV ? 60 : 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: Platform.isTV ? 30 : 18,
    color: "#8E8E93",
  },
  sectionHeader: {
    paddingHorizontal: Platform.isTV ? 16 : 16,
    paddingTop: Platform.isTV ? 32 : 24,
    paddingBottom: Platform.isTV ? 12 : 8,
  },
  sectionHeaderText: {
    fontSize: Platform.isTV ? 28 : 16,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.08,
  },
});
