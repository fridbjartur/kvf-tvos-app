import { JustifiedCard, JustifiedRow } from "@/utils/justified-grid";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

const IS_TV = Platform.isTV;
export const GRID_ROW_H_GAP = IS_TV ? 24 : 12;
export const GRID_ROW_V_GAP = IS_TV ? 32 : 20;

interface GridRowProps<T> {
  row: JustifiedRow<T>;
  /** Renders a single card; the screen owns card type + focus wiring. */
  renderCard: (card: JustifiedCard<T>) => React.ReactNode;
}

/**
 * One packed row of a justified grid: a horizontal flex of cards with a fixed
 * height and ragged right edge. Kept as the FlatList item so virtualization and
 * tvOS spatial focus operate per row.
 */
function GridRowComponent<T>({ row, renderCard }: GridRowProps<T>) {
  return <View style={styles.row}>{row.items.map((card) => renderCard(card))}</View>;
}

export const GridRow = React.memo(GridRowComponent) as typeof GridRowComponent;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: GRID_ROW_H_GAP,
    marginBottom: GRID_ROW_V_GAP,
  },
});
