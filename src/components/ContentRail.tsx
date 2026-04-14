import type { Ref } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { HomeRail, ProgramEpisodeModel } from "../api/types";
import { palette, spacing, type } from "../theme";
import { FocusableCard } from "./FocusableCard";
import { formatPublishDate, getEpisodeBadgeLabel } from "../utils/content";

type ContentRailProps =
  | {
      title?: string;
      sectionLabel?: string;
      items: HomeRail["items"];
      onSelectItem: (slug: string, section: HomeRail["section"]) => void;
      preferredFocusIndex?: number;
      nextFocusUp?: number;
      firstItemRef?: Ref<View>;
    }
  | {
      title?: string;
      sectionLabel?: string;
      items: ProgramEpisodeModel[];
      onSelectEpisode: (item: ProgramEpisodeModel) => void;
      preferredFocusIndex?: number;
      nextFocusUp?: number;
      firstItemRef?: Ref<View>;
    };

export function ContentRail(props: ContentRailProps) {
  if ("onSelectItem" in props) {
    return (
      <View style={styles.rail}>
        <View style={styles.header}>
          {props.title ? <Text style={styles.title}>{props.title}</Text> : null}
          {props.sectionLabel ? (
            <Text style={styles.section}>{props.sectionLabel}</Text>
          ) : null}
        </View>
        <FlatList
          contentContainerStyle={styles.row}
          data={props.items}
          extraData={props.nextFocusUp}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FocusableCard
              cardRef={index === 0 ? props.firstItemRef : undefined}
              badge={item.badge}
              disabled={!item.canOpenProgram}
              imageUrl={item.imageUrl}
              nextFocusUp={props.nextFocusUp}
              onPress={
                item.canOpenProgram
                  ? () => props.onSelectItem(item.slug, item.section)
                  : undefined
              }
              preferredFocus={index === (props.preferredFocusIndex ?? -1)}
              title={item.title}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    );
  }

  const sectionLabel = props.sectionLabel;

  return (
    <View style={styles.rail}>
      <View style={styles.header}>
        {props.title ? <Text style={styles.title}>{props.title}</Text> : null}
        {sectionLabel ? (
          <Text style={styles.section}>{sectionLabel}</Text>
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={styles.row}
        data={props.items}
        extraData={props.nextFocusUp}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FocusableCard
            cardRef={index === 0 ? props.firstItemRef : undefined}
            badge={getEpisodeBadgeLabel()}
            imageUrl={item.imageUrl}
            nextFocusUp={props.nextFocusUp}
            onPress={() => props.onSelectEpisode(item)}
            preferredFocus={index === (props.preferredFocusIndex ?? -1)}
            subtitle={formatPublishDate(item.publishDate)}
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
