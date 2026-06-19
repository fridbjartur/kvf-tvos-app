import { FocusableButton } from "@/components/FocusableButton";
import { settingsStyles as styles } from "./styles";
import React from "react";
import { Text, TextInput, View } from "react-native";

interface NotConnectedSectionProps {
  serverUrl: string;
  setServerUrl: (v: string) => void;
  serverUrlRef: React.RefObject<TextInput | null>;
  isValidating: boolean;
  isConnectingDemo: boolean;
  onConnect: () => void;
  onConnectDemo: () => void;
  /** Whether a saved connection exists, to offer the manual restore CTA. */
  canRestore?: boolean;
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
  canRestore = false,
  isRestoring = false,
  onRestore,
}: NotConnectedSectionProps) {
  const busy = isValidating || isConnectingDemo || isRestoring;
  const showRestore = canRestore && !!onRestore;

  return (
    <>
      <View style={styles.section}>
        <View style={[styles.listItem, styles.listItemFirst, styles.listItemLast]}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Connect to server:</Text>
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
            <Text style={styles.inputHint}>Enter an IP or hostname, or paste a full URL</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <FocusableButton title="Connect" variant="primary" onPress={onConnect} disabled={busy} isLoading={isValidating} hasTVPreferredFocus style={styles.fullWidthButton} />
        {showRestore && <FocusableButton title="Restore last connection" variant="secondary" onPress={onRestore} disabled={busy} isLoading={isRestoring} style={styles.fullWidthButton} />}
        <FocusableButton title="Try Demo Server" variant="secondary" onPress={onConnectDemo} disabled={busy} isLoading={isConnectingDemo} style={styles.fullWidthButton} />
      </View>
    </>
  );
}
