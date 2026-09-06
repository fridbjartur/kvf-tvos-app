import strings from "@/constants/strings.json";
/**
 * Settings — configure the API base URL.
 * Defaults to EXPO_PUBLIC_KVF_API_BASE_URL or the home NAS API URL.
 */

import { FocusableButton } from "@/components/FocusableButton";
import { DEFAULT_API_BASE_URL, getApiUrl, loadApiUrl, saveApiUrl } from "@/services/kvfApi";
import { refreshAll, warmOnLaunch } from "@/services/kvfPreload";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IS_TV = Platform.isTV;

export default function SettingsScreen() {
  const [url, setUrl] = useState(getApiUrl());
  const [saved, setSaved] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (IS_TV ? 80 : 20);

  // Keep UI in sync with the stored URL (may still be loading at mount).
  useEffect(() => {
    let cancelled = false;
    loadApiUrl().then(() => {
      if (!cancelled) setUrl(getApiUrl());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Saving re-namespaces the cache, so the new server's data has to be warmed
  // before the tabs are shown again — otherwise they would sit empty.
  const applyUrl = useCallback(async (next: string) => {
    await saveApiUrl(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await warmOnLaunch();
    await refreshAll();
  }, []);

  const handleSave = useCallback(() => applyUrl(url.trim() || DEFAULT_API_BASE_URL), [applyUrl, url]);

  const handleReset = useCallback(() => {
    setUrl(DEFAULT_API_BASE_URL);
    return applyUrl(DEFAULT_API_BASE_URL);
  }, [applyUrl]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topPad }]}>
        <Text style={styles.heading}>{strings.settings.heading}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>{strings.settings.apiUrlLabel}</Text>
          <Text style={styles.hint}>{strings.settings.apiUrlHint}</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder={strings.settings.apiUrlPlaceholder}
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            accessibilityLabel="API URL input"
          />
        </View>

        <View style={styles.actions}>
          <FocusableButton title={saved ? strings.settings.savedButton : strings.settings.saveButton} onPress={handleSave} variant="primary" hasTVPreferredFocus />
          <FocusableButton title={strings.settings.resetButton} onPress={handleReset} variant="secondary" />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{strings.settings.aboutTitle}</Text>
          <Text style={styles.infoText}>{strings.settings.aboutText}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: IS_TV ? 80 : 24,
    maxWidth: IS_TV ? 800 : undefined,
  },
  heading: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 40 : 26,
    fontWeight: "800",
    marginBottom: IS_TV ? 40 : 24,
  },
  section: {
    marginBottom: IS_TV ? 32 : 24,
  },
  label: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 22 : 15,
    fontWeight: "600",
    marginBottom: IS_TV ? 8 : 6,
  },
  hint: {
    color: "#8E8E93",
    fontSize: IS_TV ? 16 : 12,
    lineHeight: IS_TV ? 22 : 17,
    marginBottom: IS_TV ? 16 : 10,
  },
  input: {
    backgroundColor: "#2C2C2E",
    borderRadius: 0,
    color: "#FFFFFF",
    fontSize: IS_TV ? 20 : 15,
    paddingHorizontal: IS_TV ? 20 : 14,
    paddingVertical: IS_TV ? 16 : 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actions: {
    flexDirection: IS_TV ? "row" : "column",
    gap: IS_TV ? 20 : 12,
    marginBottom: IS_TV ? 48 : 32,
  },
  infoSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: IS_TV ? 32 : 20,
  },
  infoTitle: {
    color: "#8E8E93",
    fontSize: IS_TV ? 18 : 13,
    fontWeight: "600",
    marginBottom: IS_TV ? 8 : 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoText: {
    color: "#636366",
    fontSize: IS_TV ? 16 : 12,
    lineHeight: IS_TV ? 22 : 17,
  },
});
