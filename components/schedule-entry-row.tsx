/**
 * ScheduleEntryRow — one row of the daily skrá.
 *
 * **Every** row is focusable, including the ones with no program page behind
 * them. Making only the linked rows focusable looks tidier but breaks the
 * screen: KVF links few TV rows, so the focusable rows end up scattered
 * hundreds of points apart, and tvOS's directional focus search does not reach
 * that far. The result is a listing you can scroll into and never get out of.
 * A continuous chain of focusable rows is what lets the user walk back up to
 * the tabs, and from there out to the tab bar.
 *
 * Pressing an unlinked row does nothing, which is how a schedule grid behaves
 * anyway — focusing a row is also how you read its description.
 *
 * The section is read from the link's own `apiProgramUrl` and never guessed —
 * assuming `sjon` for a program that lives under `sjon/vit` 404s.
 */

import { FocusScaleCard } from "@/components/focus-scale-card";
import { ButtonVisual } from "@/components/button-visual";
import { sectionIdFromApiProgramUrl, type SectionId } from "@/constants/sections";
import strings from "@/constants/strings.json";
import type { ScheduleEntry } from "@/types/kvf";
import { useCallback } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const IS_TV = Platform.isTV;

/** Enough to show what a radio program played without turning the row into a list. */
const MAX_TRACKS = 3;

interface ScheduleEntryRowProps {
  entry: ScheduleEntry;
  /** The row KVF flags as on air — highlighted, not merely tagged. */
  isNow: boolean;
  onPress: (sectionId: SectionId, slug: string) => void;
}

function EntryBody({ entry, isNow, isLinked, focused }: { entry: ScheduleEntry; isNow: boolean; isLinked: boolean; focused: boolean }) {
  const tracks = entry.music.slice(0, MAX_TRACKS);

  return (
    <View style={S.body}>
      {/* Time rail: a fixed-width gutter so every title starts on the same line. */}
      <View style={S.rail}>
        <Text style={[S.startTime, isNow && S.startTimeNow]}>{entry.startTime}</Text>
        {entry.endTime ? <Text style={S.endTime}>{entry.endTime}</Text> : null}
      </View>

      <View style={[S.marker, isNow && S.markerNow]}>{isNow ? <View style={S.markerDot} /> : null}</View>

      <View style={S.details}>
        <View style={S.textColumn}>
          <View style={S.titleRow}>
            <Text numberOfLines={1} style={[S.title, isNow && S.titleNow]}>
              {entry.title}
            </Text>
            {isNow ? <Text style={S.liveTag}>{strings.schedule.liveTag}</Text> : null}
          </View>

          {entry.subtitle ? (
            <Text numberOfLines={1} style={S.subtitle}>
              {entry.subtitle}
            </Text>
          ) : null}

          {entry.description ? (
            <Text numberOfLines={2} style={S.description}>
              {entry.description}
            </Text>
          ) : null}

          {tracks.length > 0 ? (
            <Text numberOfLines={1} style={S.music}>
              {strings.schedule.music}: {tracks.map((t) => (t.artist ? `${t.title} – ${t.artist}` : t.title)).join(" · ")}
            </Text>
          ) : null}

          {entry.faroeIslandsOnly ? <Text style={S.geoTag}>{strings.schedule.faroeIslandsOnly}</Text> : null}
        </View>
        <View style={S.affordance} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {isLinked ? (
            <ButtonVisual title={strings.schedule.openProgram} iconName="arrow-forward" variant="secondary" focused={focused} style={S.linkAction} textStyle={S.actionText} />
          ) : (
            <Text style={S.readOnly}>{strings.schedule.scheduleOnly}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function ScheduleEntryRow({ entry, isNow, onPress }: ScheduleEntryRowProps) {
  const sectionId = sectionIdFromApiProgramUrl(entry.program?.apiProgramUrl);
  const slug = entry.program?.slug;
  const isLinked = Boolean(sectionId && slug);

  const handlePress = useCallback(() => {
    if (sectionId && slug) onPress(sectionId, slug);
  }, [onPress, sectionId, slug]);

  return (
    // scaleTo 1: a text row that grows on focus shoves the rows below it around.
    // The border overlay carries the focus state on its own.
    <FocusScaleCard
      onPress={isLinked ? handlePress : undefined}
      disabled={!IS_TV && !isLinked}
      activeOpacity={isLinked ? 0.9 : 1}
      scaleTo={1}
      cardStyle={[S.row, isNow && S.rowNow]}
      borderStyle={[S.rowBorder, !isLinked && S.readOnlyBorder]}
      accessibilityRole={isLinked ? "link" : "text"}
      accessibilityLabel={`${entry.startTime}. ${entry.title}. ${isLinked ? strings.schedule.openProgram : strings.schedule.scheduleOnly}`}>
      {(focused) => <EntryBody entry={entry} isNow={isNow} isLinked={isLinked} focused={focused} />}
    </FocusScaleCard>
  );
}

const S = StyleSheet.create({
  row: {
    paddingVertical: IS_TV ? 22 : 16,
    paddingHorizontal: IS_TV ? 24 : 16,
    borderRadius: IS_TV ? 12 : 8,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  rowNow: {
    backgroundColor: "#25151A",
    borderColor: "rgba(232,0,28,0.25)",
  },
  rowBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: IS_TV ? 3 : 2,
    borderColor: "#FFFFFF",
    borderRadius: IS_TV ? 12 : 8,
  },
  body: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  details: { flex: 1, flexDirection: IS_TV ? "row" : "column", gap: IS_TV ? 24 : 12 },
  affordance: { width: IS_TV ? 196 : undefined, alignSelf: IS_TV ? "center" : "flex-start", alignItems: "flex-end" },
  linkAction: { minWidth: 0, minHeight: IS_TV ? 48 : 40, paddingHorizontal: IS_TV ? 16 : 12, paddingVertical: 6 },
  actionText: { fontSize: IS_TV ? 17 : 13, lineHeight: IS_TV ? 24 : 18 },
  readOnly: { color: "#98989D", fontSize: IS_TV ? 16 : 12, lineHeight: IS_TV ? 24 : 18, paddingHorizontal: IS_TV ? 18 : 0 },
  readOnlyBorder: { borderColor: "#686870", borderWidth: IS_TV ? 2 : 1 },
  rail: {
    width: IS_TV ? 96 : 52,
  },
  startTime: {
    color: "rgba(255,255,255,0.9)",
    fontSize: IS_TV ? 25 : 14,
    fontWeight: "700",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  startTimeNow: { color: "#FF5365" },
  endTime: {
    color: "#98989D",
    fontSize: IS_TV ? 15 : 10,
    fontWeight: "500",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  // A thin spine down the listing, with a dot on the row that is on air.
  marker: {
    width: IS_TV ? 3 : 2,
    alignSelf: "stretch",
    minHeight: IS_TV ? 34 : 20,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginRight: IS_TV ? 26 : 14,
    alignItems: "center",
  },
  markerNow: { backgroundColor: "#E8001C" },
  markerDot: {
    width: IS_TV ? 13 : 8,
    height: IS_TV ? 13 : 8,
    borderRadius: IS_TV ? 7 : 4,
    backgroundColor: "#E8001C",
    marginTop: IS_TV ? 6 : 4,
  },
  textColumn: {
    flex: 1,
    gap: IS_TV ? 6 : 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 12 : 7,
  },
  title: {
    color: "rgba(255,255,255,0.92)",
    fontSize: IS_TV ? 25 : 14,
    fontWeight: "600",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  titleNow: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  liveTag: {
    color: "#FF5365",
    fontSize: IS_TV ? 12 : 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: IS_TV ? 18 : 12,
  },
  description: {
    color: "#98989D",
    fontSize: IS_TV ? 17 : 11,
    lineHeight: IS_TV ? 24 : 16,
  },
  music: {
    color: "#636366",
    fontSize: IS_TV ? 15 : 10,
    fontStyle: "italic",
  },
  geoTag: {
    color: "#636366",
    fontSize: IS_TV ? 14 : 10,
    fontWeight: "600",
  },
});
