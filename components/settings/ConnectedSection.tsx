import { FocusableButton } from "@/components/FocusableButton";
import { settingsStyles } from "./styles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

interface ConnectedSectionProps {
  serverName: string;
  serverUrl: string;
  userName: string;
  authMethod: string;
  onSignOut: () => void;
}

export function ConnectedSection({ serverName, serverUrl, userName, authMethod, onSignOut }: ConnectedSectionProps) {
  const authMethodLabel = authMethod === "quickconnect" ? "Quick Connect" : authMethod === "password" ? "Username & Password" : authMethod === "apikey" ? "API Key" : "Unknown";

  return (
    <>
      <View style={settingsStyles.section}>
        <View style={[settingsStyles.listItem, settingsStyles.listItemFirst]}>
          <View style={styles.connectedRow}>
            <Ionicons name="checkmark-circle" size={Platform.isTV ? 32 : 24} color="#34C759" />
            <View style={styles.connectedInfo}>
              <Text style={styles.connectedLabel}>Connected</Text>
              <Text style={styles.connectedValue}>{serverName}</Text>
              {serverUrl ? <Text style={styles.connectedLabel}>{serverUrl}</Text> : null}
            </View>
          </View>
        </View>

        <View style={settingsStyles.listItem}>
          <View style={styles.connectedRow}>
            <Ionicons name="person" size={Platform.isTV ? 32 : 24} color="#FFC312" />
            <View style={styles.connectedInfo}>
              <Text style={styles.connectedLabel}>User</Text>
              <Text style={styles.connectedValue}>{userName}</Text>
            </View>
          </View>
        </View>

        <View style={[settingsStyles.listItem, settingsStyles.listItemLast]}>
          <View style={styles.connectedRow}>
            <Ionicons name="key" size={Platform.isTV ? 32 : 24} color="#8E8E93" />
            <View style={styles.connectedInfo}>
              <Text style={styles.connectedLabel}>Auth Method</Text>
              <Text style={styles.connectedValue}>{authMethodLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={settingsStyles.buttonGroup}>
        <FocusableButton title="Sign Out" variant="destructive" onPress={onSignOut} style={settingsStyles.fullWidthButton} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 16 : 12,
  },
  connectedInfo: {
    flex: 1,
  },
  connectedLabel: {
    fontSize: Platform.isTV ? 24 : 14,
    color: "#8E8E93",
    marginBottom: 2,
  },
  connectedValue: {
    fontSize: Platform.isTV ? 30 : 18,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
