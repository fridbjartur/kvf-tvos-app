import type { Ref } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ContentSection } from "../api/types";
import { getSectionLabel } from "../utils/content";
import { palette, radii, spacing, type } from "../theme";

type SectionTabsProps = {
  value: ContentSection;
  onChange: (value: ContentSection) => void;
  nextFocusDown?: number;
  sjonRef?: Ref<View>;
  vitRef?: Ref<View>;
};

const tabs: ContentSection[] = ["sjon", "vit"];

export function SectionTabs({
  value,
  onChange,
  nextFocusDown,
  sjonRef,
  vitRef,
}: SectionTabsProps) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab, index) => (
        <SectionTabButton
          key={tab}
          active={value === tab}
          label={getSectionLabel(tab)}
          nextFocusDown={nextFocusDown}
          onPress={() => onChange(tab)}
          preferredFocus={index === 0}
          tabRef={tab === "sjon" ? sjonRef : vitRef}
        />
      ))}
    </View>
  );
}

function SectionTabButton({
  active,
  label,
  nextFocusDown,
  onPress,
  preferredFocus,
  tabRef,
}: {
  active: boolean;
  label: string;
  nextFocusDown?: number;
  onPress: () => void;
  preferredFocus?: boolean;
  tabRef?: Ref<View>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable
      hasTVPreferredFocus={preferredFocus}
      nextFocusDown={nextFocusDown}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      ref={tabRef}
      style={[
        styles.tab,
        active && styles.activeTab,
        focused && styles.focusedTab,
        active && focused && styles.activeFocusedTab,
      ]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
  },
  focusedTab: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  activeFocusedTab: {
    backgroundColor: "#FFFFFF",
  },
  label: {
    color: "rgba(255,255,255,0.62)",
    fontSize: type.bodyLarge,
    fontWeight: "700",
  },
  activeLabel: {
    color: "#0B0B0B",
    fontWeight: "800",
  },
});
