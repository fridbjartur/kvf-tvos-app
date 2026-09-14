/**
 * Beinleiðis — what is on air now, the live channels, and the day's schedule.
 *
 * Headers and controls share one vertical scroll view. Full-width native focus
 * guides bridge rows whose buttons do not line up horizontally.
 */

import { TVScreenScrollView } from "@/components/tv-screen-scroll-view";
import { ChannelTile, type LiveChannel } from "@/components/channel-tile";
import { FocusableButton } from "@/components/FocusableButton";
import { NowPlayingCard } from "@/components/now-playing-card";
import { ScheduleEntryRow } from "@/components/schedule-entry-row";
import { ShimmerBlock } from "@/components/shimmer-block";
import { SegmentedTabs, type TabItem } from "@/components/segmented-tabs";
import { SECTIONS, type Channel, type SectionId } from "@/constants/sections";
import strings from "@/constants/strings.json";
import { useLoading } from "@/contexts/LoadingContext";
import { useKvfResource } from "@/hooks/useKvfResource";
import { scheduleResource } from "@/services/kvfApi";
import { setActiveSchedule } from "@/services/kvfPreload";
import type { SchedulePage } from "@/types/kvf";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TVFocusGuideView, View, useWindowDimensions } from "react-native";

const IS_TV = Platform.isTV;

/** Live streams, which the schedule endpoint does not carry. */
const LIVE_CHANNELS: Readonly<Record<Channel, readonly LiveChannel[]>> = {
  sjon: [
    { name: "KVF", subtitle: "Sjónvarp", url: "https://w-live-edge1.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8", colors: ["#B3121F", "#2A0508"] },
    { name: "KVF 2", subtitle: "Sjónvarp 2", url: "https://w-live-edge1.kringvarp.fo/kvf-2/_definst_/smil:kvf-2.smil/playlist.m3u8", colors: ["#1D4ED8", "#0A1230"] },
  ],
  ljod: [
    { name: "KVF", subtitle: "Útvarp", url: "https://w-live-edge2.kringvarp.fo/radio/_definst_/radio.stream/playlist.m3u8", colors: ["#3B3B98", "#14142B"] },
    // Direct AAC+ radio stream. The host-specific ATS exception in app.json
    // permits its HTTP connection, including the player's initial request.
    { name: "KVF 2", subtitle: "Útvarp 2", url: "http://netvarp.kringvarp.fo:4443/kvf2_1", colors: ["#0E7490", "#062730"] },
  ],
};

/** Radio is listened to, not watched. */
const ACTION_LABEL: Readonly<Record<Channel, string>> = {
  sjon: strings.schedule.watchLive,
  ljod: strings.schedule.listenLive,
};

// Module scope — the array identity never changes, so neither does the tab row.
const CHANNEL_TABS: TabItem<Channel>[] = [
  { id: "sjon", label: SECTIONS.sjon.label },
  { id: "ljod", label: SECTIONS.ljod.label },
];

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const wideLayout = IS_TV && width >= 1100;
  const router = useRouter();
  const { showGlobalLoader } = useLoading();

  const [channel, setChannel] = useState<Channel>("sjon");
  // null means "whatever today is" — resolved server-side in Atlantic/Faroe.
  const [date, setDate] = useState<string | null>(null);

  const resource = useMemo(() => scheduleResource(channel, date), [channel, date]);
  const { data: page, isLoading, isRefreshing, error } = useKvfResource<SchedulePage>(resource, strings.schedule.failedToLoad);

  // Keep the last good day on screen while the next one loads: `page` is null
  // for one commit on every swap, which would flick both day buttons to
  // disabled — and a disabled button drops the focus it was holding.
  // State adjustment during render, as in HeroBanner: no effect, no cascade.
  const [view, setView] = useState<SchedulePage | null>(null);
  const [viewChannel, setViewChannel] = useState<Channel>(channel);

  // A *channel* swap drops the snapshot, so the other channel's listing can
  // never linger — and an error on the new channel is actually reported.
  // A *date* swap keeps it, which is the case the snapshot exists for.
  if (viewChannel !== channel) {
    setViewChannel(channel);
    setView(null);
  }
  if (page && page !== view) setView(page);

  // The schedule's five-minute TTL is shorter than the central refresh
  // interval, so kvfPreload polls whichever schedule is currently on screen.
  useEffect(() => {
    setActiveSchedule(resource);
    return () => setActiveSchedule(null);
  }, [resource]);

  const handleChannel = useCallback((next: Channel) => {
    // Identity-preserving: re-pressing the active tab must not re-render.
    setChannel((prev) => (prev === next ? prev : next));
    setDate(null);
  }, []);

  const goPreviousDay = useCallback(() => {
    if (view?.previousDate) setDate(view.previousDate);
  }, [view]);

  const goNextDay = useCallback(() => {
    if (view?.nextDate) setDate(view.nextDate);
  }, [view]);

  const handleChannelPress = useCallback(
    (name: string, url: string) => {
      showGlobalLoader();
      router.push({ pathname: "/player", params: { streamUrl: url, title: name, isLive: "true" } });
    },
    [router, showGlobalLoader],
  );

  const handleEntryPress = useCallback(
    (sectionId: SectionId, slug: string) => {
      router.push({ pathname: "/program", params: { section: sectionId, slug } });
    },
    [router],
  );

  const channels = LIVE_CHANNELS[channel];
  const primary = channels.find((c) => c.url) ?? null;
  const nowPlaying = view?.nowPlaying ?? null;

  // A date swap changes the cache key, so the incoming day is a *first* load
  // (isLoading) even though the retained snapshot keeps the screen populated.
  // Both that and a background revalidation deserve the same passive pip.
  const showRefreshPip = isRefreshing || (isLoading && view !== null);

  return (
    <TVScreenScrollView contentContainerStyle={S.scrollContent} isRefreshing={showRefreshPip}>
      <View style={S.header}>
        <Text style={S.pageTitle}>{strings.tabs.live}</Text>
        <TVFocusGuideView autoFocus>
          <SegmentedTabs items={CHANNEL_TABS} selected={channel} onSelect={handleChannel} />
        </TVFocusGuideView>
      </View>

      <View style={[S.featured, wideLayout && S.featuredWide]}>
        <View style={S.heroColumn}>
          <NowPlayingCard
            entry={nowPlaying}
            streamUrl={primary?.url ?? null}
            channelName={primary?.subtitle ?? SECTIONS[channel].label}
            actionLabel={ACTION_LABEL[channel]}
            onPlay={handleChannelPress}
            isLoading={isLoading && !view}
            isAudio={channel === "ljod"}
          />
        </View>

        <View style={[S.channelsColumn, wideLayout && S.channelsColumnWide]}>
          <Text style={S.channelsHeading}>{strings.schedule.channelsHeading}</Text>
          <TVFocusGuideView autoFocus style={[S.channelGrid, wideLayout && S.channelGridVertical]}>
            {channels.map((ch) => (
              <ChannelTile key={ch.name} channel={ch} nowPlayingTitle={ch === primary ? nowPlaying?.title : null} onPress={handleChannelPress} />
            ))}
          </TVFocusGuideView>
        </View>
      </View>

      <View style={S.block}>
        <TVFocusGuideView autoFocus style={S.scheduleHeader}>
          <Text style={S.sectionHeading}>{strings.schedule.scheduleHeading}</Text>
          <View style={S.dayNav}>
            <FocusableButton title={strings.schedule.previousDay} variant="secondary" onPress={goPreviousDay} disabled={!view?.previousDate} style={S.dayButton} />
            <View style={S.dayLabels}>
              <Text style={S.dayLabel}>{view?.dateLabel ?? view?.date ?? ""}</Text>
              {view?.weekday ? <Text style={S.weekday}>{view.weekday}</Text> : null}
            </View>
            <FocusableButton title={strings.schedule.nextDay} variant="secondary" onPress={goNextDay} disabled={!view?.nextDate} style={S.dayButton} />
          </View>
        </TVFocusGuideView>

        {isLoading && !view ? (
          <View style={S.entries} accessibilityLabel={strings.program.loadingButton} accessibilityState={{ busy: true }}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={S.skeletonRow}>
                <ShimmerBlock style={S.skeletonTime} delayMs={index * 100} />
                <View style={S.skeletonCopy}>
                  <ShimmerBlock style={S.skeletonTitle} delayMs={index * 100} />
                  <ShimmerBlock style={S.skeletonDescription} delayMs={index * 100 + 80} />
                </View>
              </View>
            ))}
          </View>
        ) : error && !view ? (
          <View style={S.status}>
            <Text style={S.errorText}>{error}</Text>
          </View>
        ) : view && view.entries.length === 0 ? (
          <View style={S.status}>
            <Text style={S.emptyText}>{strings.schedule.empty}</Text>
          </View>
        ) : (
          <View style={S.entries}>
            {/* nowPlaying is reference-identical to its row, so "is this on air?" is a === check. */}
            {view?.entries.map((entry) => (
              <ScheduleEntryRow key={entry.listKey} entry={entry} isNow={entry === nowPlaying} onPress={handleEntryPress} />
            ))}
          </View>
        )}
      </View>

      <View style={S.bottomPad} />
    </TVScreenScrollView>
  );
}

// Named "S" not "styles" — prevents editor auto-import from shadowing the local definition.
const S = StyleSheet.create({
  scrollContent: { paddingTop: IS_TV ? 32 : 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: IS_TV ? 24 : 16,
    paddingHorizontal: IS_TV ? 80 : 24,
  },
  pageTitle: { color: "#FFFFFF", fontSize: IS_TV ? 48 : 30, lineHeight: IS_TV ? 58 : 38, fontWeight: "800", letterSpacing: -1 },
  featured: { marginTop: IS_TV ? 28 : 24, marginHorizontal: IS_TV ? 80 : 24, gap: IS_TV ? 28 : 24 },
  featuredWide: { flexDirection: "row", alignItems: "stretch" },
  heroColumn: { flex: 2, minWidth: 0 },
  channelsColumn: { gap: IS_TV ? 16 : 12 },
  channelsColumnWide: { flex: 1, minWidth: 0 },
  channelsHeading: { color: "#A9A9B3", fontSize: IS_TV ? 18 : 14, fontWeight: "600", letterSpacing: 0.3 },
  block: {
    marginTop: IS_TV ? 40 : 32,
    paddingHorizontal: IS_TV ? 80 : 24,
    gap: IS_TV ? 20 : 16,
  },
  sectionHeading: {
    color: "rgba(255,255,255,0.85)",
    fontSize: IS_TV ? 28 : 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  channelGrid: {
    flexDirection: "row",
    flex: 1,
    gap: IS_TV ? 20 : 12,
  },
  channelGridVertical: { flexDirection: "column" },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: IS_TV ? 24 : 14,
  },
  dayNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: IS_TV ? 16 : 8,
  },
  dayButton: {
    minWidth: IS_TV ? 56 : 44,
    minHeight: IS_TV ? 56 : 44,
    paddingHorizontal: IS_TV ? 16 : 10,
    paddingVertical: 4,
  },
  dayLabels: {
    minWidth: IS_TV ? 240 : 132,
    alignItems: "center",
  },
  dayLabel: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 24 : 14,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  weekday: {
    color: "#A9A9B3",
    fontSize: IS_TV ? 16 : 11,
    fontWeight: "500",
    marginTop: 2,
  },
  entries: {
    gap: IS_TV ? 8 : 6,
  },
  skeletonRow: { flexDirection: "row", alignItems: "flex-start", gap: IS_TV ? 32 : 20, padding: IS_TV ? 24 : 16, borderRadius: 12, backgroundColor: "#141416" },
  skeletonTime: { width: IS_TV ? 80 : 44, height: IS_TV ? 24 : 18, borderRadius: 4 },
  skeletonCopy: { flex: 1, gap: IS_TV ? 12 : 8 },
  skeletonTitle: { width: "44%", height: IS_TV ? 24 : 18, borderRadius: 4 },
  skeletonDescription: { width: "72%", height: IS_TV ? 16 : 12, borderRadius: 4 },
  status: {
    paddingVertical: IS_TV ? 90 : 44,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#FF3B30", fontSize: IS_TV ? 20 : 15, textAlign: "center", padding: 32 },
  emptyText: { color: "#98989D", fontSize: IS_TV ? 20 : 15, textAlign: "center" },
  bottomPad: { height: IS_TV ? 100 : 48 },
});
