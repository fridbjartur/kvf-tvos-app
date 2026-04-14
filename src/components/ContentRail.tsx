import { FlatList, StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "../theme";
import { FocusableCard } from "./FocusableCard";

export type RailCard = {
  id: string;
  title: string;
  imageUrl: string | null;
  badge?: string;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
};

type ContentRailProps = {
  title?: string;
  sectionLabel?: string;
  cards: RailCard[];
};

export function ContentRail({ title, sectionLabel, cards }: ContentRailProps) {
  return (
    <View style={styles.rail}>
      <View style={styles.header}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {sectionLabel ? <Text style={styles.section}>{sectionLabel}</Text> : null}
      </View>
      <FlatList
        contentContainerStyle={styles.row}
        data={cards}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FocusableCard
            badge={item.badge}
            disabled={item.disabled}
            imageUrl={item.imageUrl}
            onPress={item.onPress}
            subtitle={item.subtitle}
            title={item.title}
          />
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: spacing.sm,
    marginTop: spacing.xl + spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: {
    color: palette.text,
    fontSize: type.title,
    fontWeight: "800",
  },
  section: {
    color: palette.textMuted,
    fontSize: type.body,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    gap: spacing.xl,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xl,
    paddingVertical: spacing.md,
  },
});
