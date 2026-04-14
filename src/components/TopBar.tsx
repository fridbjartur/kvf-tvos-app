import { StyleSheet, Text, View } from "react-native";
import type { ContentSection } from "../api/types";
import { navigationRef } from "../navigation/ref";
import { useSection } from "../context/SectionContext";
import { SectionTabs } from "./SectionTabs";
import type { NavSection } from "./SectionTabs";
import { palette, spacing, type } from "../theme";

type TopBarProps = {
  tabsFocusable?: boolean;
  routeName?: string;
};

export function TopBar({ tabsFocusable = true, routeName }: TopBarProps) {
  const { activeSection, setActiveSection } = useSection();

  function handleChange(section: NavSection) {
    if (section === "live") {
      if (navigationRef.isReady()) navigationRef.navigate("Live");
    } else {
      setActiveSection(section as ContentSection);
      if (navigationRef.isReady()) navigationRef.navigate("Home");
    }
  }

  const activeTab: NavSection = routeName === "Live" ? "live" : activeSection;

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Text style={styles.brand}>KVF</Text>
      </View>
      <SectionTabs
        value={activeTab}
        onChange={handleChange}
        tabsFocusable={tabsFocusable}
      />
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: palette.background,
  },
  brand: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  side: {
    flex: 1,
  },
});
