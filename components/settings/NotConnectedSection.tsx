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
}

export function NotConnectedSection({ serverUrl, setServerUrl, serverUrlRef, isValidating, isConnectingDemo, onConnect, onConnectDemo }: NotConnectedSectionProps) {
  return (
    <>
      <View style={styles.section}>
        <View style={[styles.listItem, styles.listItemFirst, styles.listItemLast]}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Server Address</Text>
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
        <FocusableButton title="Connect" variant="primary" onPress={onConnect} disabled={isValidating || isConnectingDemo} isLoading={isValidating} style={styles.fullWidthButton} />
        <FocusableButton title="Try Demo Server" variant="secondary" onPress={onConnectDemo} disabled={isValidating || isConnectingDemo} isLoading={isConnectingDemo} style={styles.fullWidthButton} />
      </View>
    </>
  );
}
