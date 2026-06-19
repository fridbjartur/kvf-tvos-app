import { FocusableButton } from "@/components/FocusableButton";
import { settingsStyles as styles } from "./styles";
import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

interface NotConnectedSectionProps {
  serverUrl: string;
  setServerUrl: (v: string) => void;
  serverUrlRef: React.RefObject<TextInput | null>;
  isValidating: boolean;
  isConnectingDemo: boolean;
  onConnect: () => void;
  onConnectDemo: () => void;
  /** Last saved connection, when one exists, to offer a manual restore. */
  lastConnection?: { url: string; serverName: string } | null;
  isRestoring?: boolean;
  onRestore?: () => void;
}

export function NotConnectedSection({
  serverUrl,
  setServerUrl,
  serverUrlRef,
  isValidating,
  isConnectingDemo,
  onConnect,
  onConnectDemo,
  lastConnection,
  isRestoring = false,
  onRestore,
}: NotConnectedSectionProps) {
  const busy = isValidating || isConnectingDemo || isRestoring;
  const showRestore = !!lastConnection && !!onRestore;

  return (
    <>
      {showRestore && (
        <>
          <View style={styles.section}>
            <View style={[styles.listItem, styles.listItemFirst, styles.listItemLast]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Last Connection</Text>
                <Text style={localStyles.serverName}>{lastConnection!.serverName}</Text>
                <Text style={styles.inputHint}>{lastConnection!.url}</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <FocusableButton title="Restore last connection" variant="primary" onPress={onRestore} disabled={busy} isLoading={isRestoring} hasTVPreferredFocus style={styles.fullWidthButton} />
          </View>
        </>
      )}

      <View style={styles.section}>
        <View style={[styles.listItem, styles.listItemFirst, styles.listItemLast]}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{showRestore ? "Connect To A Different Server" : "Server Address"}</Text>
            <TextInput
              ref={serverUrlRef}
              value={serverUrl}
              placeholder="192.168.1.100 or jellyfin.example.com"
              placeholderTextColor="#8E8E93"
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={setServerUrl}
              style={styles.textInput}
              autoFocus={false}
              numberOfLines={1}
              multiline={false}
              onSubmitEditing={onConnect}
              returnKeyType="go"
            />
            <Text style={styles.inputHint}>Enter an IP or hostname and we&apos;ll find it, or paste a full URL</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <FocusableButton title="Connect" variant={showRestore ? "secondary" : "primary"} onPress={onConnect} disabled={busy} isLoading={isValidating} style={styles.fullWidthButton} />
        <FocusableButton title="Try Demo Server" variant="secondary" onPress={onConnectDemo} disabled={busy} isLoading={isConnectingDemo} style={styles.fullWidthButton} />
      </View>
    </>
  );
}

const localStyles = StyleSheet.create({
  serverName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 2,
  },
});
