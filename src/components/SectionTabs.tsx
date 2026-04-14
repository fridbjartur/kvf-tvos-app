import { StyleSheet, View } from "react-native";
import type { ContentSection } from "../api/types";
import { getSectionLabel } from "../utils/content";
import { spacing } from "../theme";
import { Button } from "./Button";

export type NavSection = ContentSection | "live";

type SectionTabsProps = {
  value: NavSection;
  onChange: (value: NavSection) => void;
  tabsFocusable?: boolean;
};

const tabs: NavSection[] = ["sjon", "vit", "live"];

export function SectionTabs({
  value,
  onChange,
  tabsFocusable = true,
}: SectionTabsProps) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Button
          key={tab}
          focusable={tabsFocusable}
          label={getSectionLabel(tab)}
          onPress={() => onChange(tab)}
          selected={value === tab}
          size="md"
          style={styles.tab}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: spacing.lg,
  },
  tab: {
    minWidth: 120,
    borderColor: "transparent",
  },
});
