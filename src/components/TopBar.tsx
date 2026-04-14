import { StyleSheet, Text, View } from "react-native";
import type { ContentSection } from "../api/types";
import { navigationRef } from "../navigation/ref";
import { useSection } from "../context/SectionContext";
import { SectionTabs } from "./SectionTabs";
import { palette, spacing, type } from "../theme";

export function TopBar() {
  const { activeSection, setActiveSection } = useSection();

  function handleSectionChange(section: ContentSection) {
    setActiveSection(section);
    if (navigationRef.isReady()) {
      navigationRef.navigate("Home");
    }
  }

  return (
    <View style={styles.bar}>
      <Text style={styles.brand}>KVF</Text>
      <SectionTabs value={activeSection} onChange={handleSectionChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: palette.background,
  },
  brand: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
});
