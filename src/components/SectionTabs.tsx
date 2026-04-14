import { StyleSheet, View } from "react-native";
import type { ContentSection } from "../api/types";
import { getSectionLabel } from "../utils/content";
import { spacing } from "../theme";
import { Button } from "./Button";

type SectionTabsProps = {
  value: ContentSection;
  onChange: (value: ContentSection) => void;
  tabsFocusable?: boolean;
};

const tabs: ContentSection[] = ["sjon", "vit"];

export function SectionTabs({ value, onChange, tabsFocusable = true }: SectionTabsProps) {
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
    marginTop: spacing.md,
  },
  tab: {
    minWidth: 120,
  },
});
