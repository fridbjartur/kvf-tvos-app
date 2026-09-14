/**
 * SegmentedTabs — an in-screen tab strip, meant to be rendered inside the same
 * ScrollView as the content it switches.
 *
 * Deliberately a plain View rather than a horizontal FlatList: nesting a second
 * scroll view is what blocks upward D-pad traversal once the outer one has
 * scrolled (see memories/CLAUDE-lessons-learned.md). A handful of tabs needs no
 * virtualisation.
 *
 * Selection happens on *press*, never on focus — selecting on focus would swap
 * the content under every tab the user D-pads across on the way to the one they
 * actually want.
 */

import { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const IS_TV = Platform.isTV;

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabProps<T extends string> {
  item: TabItem<T>;
  isSelected: boolean;
  onSelect: (id: T) => void;
  hasTVPreferredFocus?: boolean;
}

function Tab<T extends string>({ item, isSelected, onSelect, hasTVPreferredFocus }: TabProps<T>) {
  const [focused, setFocused] = useState(false);

  const handlePress = useCallback(() => onSelect(item.id), [item.id, onSelect]);
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);

  return (
    <Pressable
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      isTVSelectable
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={item.label}
      // No scale animation: focus stays on the tab after a press, and a tab
      // that grows shifts its own focus frame while the content swaps below it.
      style={S.tab}>
      <View style={[S.labelWrap, focused && S.labelWrapFocused]}>
        <Text style={[S.label, isSelected && S.labelSelected, focused && S.labelFocused]}>{item.label}</Text>
      </View>
      {/* Always rendered so selecting a tab never changes the row's height. */}
      <View style={[S.indicator, isSelected && S.indicatorSelected, focused && S.indicatorFocused]} />
    </Pressable>
  );
}

interface SegmentedTabsProps<T extends string> {
  items: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Claims initial focus for the selected tab on the screen's first paint. */
  hasTVPreferredFocus?: boolean;
}

export function SegmentedTabs<T extends string>({ items, selected, onSelect, hasTVPreferredFocus }: SegmentedTabsProps<T>) {
  return (
    <View style={S.row}>
      {items.map((item) => (
        <Tab key={item.id} item={item} isSelected={item.id === selected} onSelect={onSelect} hasTVPreferredFocus={hasTVPreferredFocus && item.id === selected} />
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: IS_TV ? 12 : 6,
  },
  tab: {
    alignItems: "center",
    gap: IS_TV ? 10 : 6,
  },
  labelWrap: {
    paddingHorizontal: IS_TV ? 30 : 14,
    paddingVertical: IS_TV ? 10 : 6,
    borderRadius: IS_TV ? 12 : 8,
    backgroundColor: "transparent",
  },
  labelWrapFocused: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: IS_TV ? 30 : 16,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  // Selected and focused are styled independently: after a press a tab is both,
  // and the user needs to read both states at once.
  labelSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  labelFocused: {
    color: "#FFFFFF",
  },
  indicator: {
    height: IS_TV ? 4 : 3,
    width: "70%",
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  indicatorSelected: {
    backgroundColor: "#E8001C",
  },
  indicatorFocused: {
    backgroundColor: "#FFFFFF",
  },
});
