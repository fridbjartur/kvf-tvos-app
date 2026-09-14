import React from "react";
import { Image } from "expo-image";
import TestRenderer, { act } from "react-test-renderer";
import { ScrollView, TVFocusGuideView, TouchableOpacity, Pressable, View, Text, StyleSheet, Platform, type HWEvent } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { TVScreenScrollView } from "../tv-screen-scroll-view";
import { FocusScaleCard } from "../focus-scale-card";
import { HeroBanner, HERO_H } from "../HeroBanner";
import { NowPlayingCard } from "../now-playing-card";
import { ScheduleEntryRow } from "../schedule-entry-row";
import { FocusableButton } from "../FocusableButton";
import { SegmentedTabs } from "../segmented-tabs";
import { useScreenBack } from "@/hooks/useScreenBack";
import LjodSectionScreen from "@/app/(tabs)/ljod/[section]";
import LjodPickerScreen from "@/app/(tabs)/ljod/index";
import ScheduleScreen from "@/app/(tabs)/schedule";
import { SectionScreen } from "../section-screen";
import { useKvfResource } from "@/hooks/useKvfResource";
import { DESIGN } from "@/constants/app";
import TabLayout from "@/app/(tabs)/_layout";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { FeaturedProgram, ScheduleEntry } from "@/types/kvf";
import strings from "@/constants/strings.json";

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react");
  const Trigger = Object.assign((props: object) => React.createElement("TabTrigger", props), { Icon: "TabIcon", Label: "TabLabel" });
  return { NativeTabs: Object.assign((props: object) => React.createElement("NativeTabs", props), { Trigger }) };
});

let mockFocused = true;
let tvHandler: (event: HWEvent) => void;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused, useFocusEffect: jest.fn(), useRouter: jest.fn(), useLocalSearchParams: () => ({ section: "ljod" }) }));
jest.mock("@/hooks/useScreenBack", () => ({ useScreenBack: jest.fn() }));
jest.mock("@/hooks/useKvfResource", () => ({ useKvfResource: jest.fn() }));
jest.mock("@/services/kvfApi", () => ({ frontPageResource: jest.fn(), scheduleResource: jest.fn() }));
jest.mock("@/services/kvfPreload", () => ({ setActiveSchedule: jest.fn() }));
jest.mock("@/contexts/LoadingContext", () => ({ useLoading: () => ({ showGlobalLoader: jest.fn() }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@/components/MarqueeText", () => ({ MarqueeText: "MarqueeText" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 100, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-blur", () => ({ BlurView: "BlurView" }));

let renderer: TestRenderer.ReactTestRenderer;
function render(element: React.ReactElement) {
  act(() => {
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
  return renderer.root;
}

beforeEach(() => {
  mockFocused = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(require("react-native"), "useTVEventHandler").mockImplementation((handler) => {
    tvHandler = handler as typeof tvHandler;
  });
  jest.mocked(useRouter).mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>);
  jest.mocked(useKvfResource).mockReturnValue({ data: null, isLoading: true, isRefreshing: false, error: null, refresh: jest.fn() });
});
afterEach(() => {
  act(() => renderer.unmount());
  renderer = undefined!;
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it("keeps the scroll view first and excludes inactive retained screens from native focus", () => {
  const element = (
    <TVScreenScrollView>
      <Pressable />
    </TVScreenScrollView>
  );
  const root = render(element);
  expect(root.findByType(TVScreenScrollView).children[0]).toBe(root.findByType(ScrollView));
  expect(root.findByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe("automatic");
  expect(root.findByType(TVFocusGuideView).props).toMatchObject({ autoFocus: true, focusable: true });
  mockFocused = false;
  render(
    <TVScreenScrollView>
      <Pressable />
    </TVScreenScrollView>,
  );
  expect(root.findByType(TVFocusGuideView).props.focusable).toBe(false);
  mockFocused = true;
  render(
    <TVScreenScrollView>
      <Pressable />
    </TVScreenScrollView>,
  );
  expect(root.findByType(TVFocusGuideView).props.focusable).toBe(true);
});

it("pushes each radio choice once per visit and allows selection again after Back", () => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  const root = render(<LjodPickerScreen />);
  let cards = root.findAllByType(FocusScaleCard);
  act(() => {
    cards[1].props.onPress();
    cards[1].props.onPress();
  });
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenLastCalledWith({ pathname: "/(tabs)/ljod/[section]", params: { section: "ljod-vit" } });
  // React Navigation invokes the registered focus effect after popping.
  act(() => {
    jest.mocked(useFocusEffect).mock.calls.at(-1)![0]();
  });
  cards = root.findAllByType(FocusScaleCard);
  act(() => {
    cards[0].props.onPress();
  });
  expect(push).toHaveBeenCalledTimes(2);
  expect(push).toHaveBeenLastCalledWith({ pathname: "/(tabs)/ljod/[section]", params: { section: "ljod" } });
  expect(cards.every((card) => !card.props.hasTVPreferredFocus)).toBe(true);
});

it("keeps one focusable action in the hero, with no nested button in its slides", () => {
  const onPress = jest.fn();
  const hero = { listKey: "hero", slug: "news", title: "News" } as FeaturedProgram;
  const root = render(<HeroBanner heroes={[hero]} onPress={onPress} />);
  expect(root.findAllByType(TouchableOpacity)).toHaveLength(1);
  expect(root.findAllByType(Pressable)).toHaveLength(0);
  act(() => {
    root.findByType(TouchableOpacity).props.onPress();
  });
  expect(onPress).toHaveBeenCalledWith(hero);
});

it("bridges the full live banner and channel selector with native guides", () => {
  const root = render(<ScheduleScreen />);
  const banner = root.findByType(NowPlayingCard);
  expect(banner.findByType(TVFocusGuideView).props.autoFocus).toBe(true);
  const selectorGuide = root.findAllByType(TVFocusGuideView).find((guide) => guide.props.children?.type === SegmentedTabs);
  expect(selectorGuide?.props.autoFocus).toBe(true);
  expect(root.findAllByType(TVFocusGuideView).every((guide) => !guide.props.trapFocusUp && !guide.props.trapFocusDown)).toBe(true);
  expect(root.findAllByType(Pressable).every((button) => !button.props.hasTVPreferredFocus)).toBe(true);
});

it("keeps live playback available while the schedule loads without reporting off-air", () => {
  const push = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  const root = render(<ScheduleScreen />);
  const banner = root.findByType(NowPlayingCard);
  expect(banner.props.isLoading).toBe(true);
  expect(banner.findAllByType(Text).some((text) => text.props.children === strings.schedule.offAir)).toBe(false);
  const play = banner.findByType(FocusableButton);
  expect(play.props.disabled).toBeFalsy();
  expect(play.props.isLoading).toBeFalsy();
  act(() => play.props.onPress());
  expect(push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/player", params: expect.objectContaining({ isLive: "true" }) }));
});

it("updates live artwork when the program changes and keeps the play focus target mounted", () => {
  const entry = { title: "News", thumbnailUrl: "https://kvf.fo/news.jpg", startTime: "18:00", endTime: "18:30", startsAt: "2026-09-14T18:00:00Z", endsAt: "2026-09-14T18:30:00Z" } as ScheduleEntry;
  const props = { streamUrl: "https://kvf.fo/live.m3u8", channelName: "KVF", actionLabel: strings.schedule.watchLive, onPlay: jest.fn() };
  const root = render(<NowPlayingCard {...props} entry={entry} />);
  const play = root.findByType(FocusableButton);
  const next = { ...entry, title: "Next", thumbnailUrl: "https://kvf.fo/next.jpg" };
  render(<NowPlayingCard {...props} entry={next} />);
  expect(root.findByType(Image).props.source).toEqual({ uri: next.thumbnailUrl });
  expect(root.findByType(Image).props.recyclingKey).toBe(next.thumbnailUrl);
  expect(root.findByType(FocusableButton)).toBe(play);
});

it("only offers a schedule action when both the program route and slug are valid", () => {
  const onPress = jest.fn();
  const entry = { title: "News", startTime: "18:00", music: [], program: null } as unknown as ScheduleEntry;
  const root = render(<ScheduleEntryRow entry={entry} isNow={false} onPress={onPress} />);
  const card = root.findByType(FocusScaleCard);
  expect(card.props.onPress).toBeUndefined();
  expect(card.props.accessibilityRole).toBe("text");
  expect(card.props.activeOpacity).toBe(1);
  expect(card.props.accessibilityLabel).toContain(strings.schedule.scheduleOnly);
  expect(root.findByType(TouchableOpacity).props.isTVSelectable).toBe(true);

  const linked = { ...entry, program: { slug: "news", apiProgramUrl: "/api/sjon/vit/programs/news" } } as ScheduleEntry;
  render(<ScheduleEntryRow entry={linked} isNow={false} onPress={onPress} />);
  expect(root.findByType(FocusScaleCard)).toBe(card);
  expect(card.props.accessibilityRole).toBe("link");
  expect(card.props.accessibilityLabel).toContain(strings.schedule.openProgram);
  act(() => card.props.onPress());
  expect(onPress).toHaveBeenCalledWith("sjon-vit", "news");

  render(<ScheduleEntryRow entry={{ ...linked, program: { ...linked.program!, apiProgramUrl: null } }} isNow={false} onPress={onPress} />);
  expect(card.props.onPress).toBeUndefined();
  render(<ScheduleEntryRow entry={{ ...linked, program: { ...linked.program!, slug: "" } }} isNow={false} onPress={onPress} />);
  expect(card.props.onPress).toBeUndefined();
});

it("keeps the section scroll/focus boundary mounted through loading, content, and errors", () => {
  const root = render(<SectionScreen section="ljod" />);
  const scroll = root.findByType(ScrollView).instance;
  jest.mocked(useKvfResource).mockReturnValue({ data: { featuredPrograms: [], categories: [] }, isLoading: false, error: null } as ReturnType<typeof useKvfResource>);
  render(<SectionScreen section="ljod" />);
  expect(root.findByType(ScrollView).instance).toBe(scroll);
  jest.mocked(useKvfResource).mockReturnValue({ data: null, isLoading: false, error: "offline" } as ReturnType<typeof useKvfResource>);
  render(<SectionScreen section="ljod" />);
  expect(root.findByType(ScrollView).instance).toBe(scroll);
});

const slides = [
  { listKey: "a", slug: "a", title: "First" },
  { listKey: "b", slug: "b", title: "Second" },
  { listKey: "c", slug: "c", title: "Third" },
] as FeaturedProgram[];

it("advances once per remote press and preserves the slide and touchable across a refresh", () => {
  const onPress = jest.fn();
  const root = render(<HeroBanner heroes={slides} onPress={onPress} />);
  const touchable = root.findByType(TouchableOpacity);
  act(() => {
    touchable.props.onFocus();
  });
  act(() => {
    // UITapGestureRecognizer reports only Ended, not a down/up pair.
    tvHandler({ eventType: "right", eventKeyAction: 1 });
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[1]);
  const refreshed = [slides[2], { ...slides[1], title: "Updated" }, slides[0]];
  render(<HeroBanner heroes={refreshed} onPress={onPress} />);
  expect(root.findByType(TouchableOpacity)).toBe(touchable);
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(refreshed[1]);
  render(<HeroBanner heroes={[slides[0]]} onPress={onPress} />);
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[0]);
});

it("pauses auto-advance while focused or offscreen and ignores offscreen remote input", () => {
  const onPress = jest.fn();
  const root = render(<HeroBanner heroes={slides} onPress={onPress} />);
  const touchable = root.findByType(TouchableOpacity);
  act(() => {
    jest.advanceTimersByTime(8000);
  });
  act(() => {
    touchable.props.onPress();
    touchable.props.onFocus();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[1]);
  act(() => {
    jest.advanceTimersByTime(16000);
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[1]);
  mockFocused = false;
  render(<HeroBanner heroes={slides} onPress={onPress} />);
  expect(touchable.props.disabled).toBe(true);
  onPress.mockClear();
  act(() => {
    tvHandler({ eventType: "right", eventKeyAction: 0 });
    touchable.props.onPress();
    touchable.props.onBlur();
    jest.advanceTimersByTime(24000);
  });
  expect(onPress).not.toHaveBeenCalled();
  mockFocused = true;
  render(<HeroBanner heroes={slides} onPress={onPress} />);
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[1]);
});

it("keeps hero focus horizontal with vertical exits, no parallax, and rounded decorative buttons", () => {
  const root = render(<HeroBanner heroes={slides} onPress={jest.fn()} />);
  const guide = root.findByType(TVFocusGuideView);
  expect(guide.props).toMatchObject({ trapFocusLeft: true, trapFocusRight: true });
  expect(guide.props.trapFocusUp).toBeFalsy();
  expect(guide.props.trapFocusDown).toBeFalsy();
  expect(root.findByType(TouchableOpacity).props.tvParallaxProperties.enabled).toBe(false);
  const buttons = root.findAll((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.borderRadius === DESIGN.BORDER_RADIUS_SMALL && style?.borderWidth > 0;
  });
  expect(buttons.length).toBeGreaterThan(0);
  expect(root.findAllByType(Pressable)).toHaveLength(0);
});

it("keeps automatic insets while only the artwork extends behind the tab bar", () => {
  jest.mocked(useKvfResource).mockReturnValue({ data: { featuredPrograms: slides, categories: [] }, isLoading: false, error: null } as ReturnType<typeof useKvfResource>);
  const root = render(<SectionScreen section="ljod" />);
  expect(root.findByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe("automatic");
  const hero = root.findByType(HeroBanner);
  const frame = hero.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.height === HERO_H - 100);
  expect(frame).toBeDefined();
  const artwork = hero.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.top === -100);
  expect(artwork?.props.pointerEvents).toBe("none");
  expect(artwork?.findAllByType(TouchableOpacity)).toHaveLength(0);
  expect(StyleSheet.flatten(hero.findByType(TouchableOpacity).props.style)).toEqual({ flex: 1 });
  jest.mocked(useKvfResource).mockReturnValue({ data: { featuredPrograms: [], categories: [] }, isLoading: false, error: null } as ReturnType<typeof useKvfResource>);
  render(<SectionScreen section="ljod" />);
  expect(root.findByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe("automatic");
});

it("preserves the radio stack and scroll position when the TV tab is reselected", () => {
  jest.spyOn(Platform, "isTV", "get").mockReturnValue(true);
  const root = render(<TabLayout />);
  const triggers = root.findAllByType(NativeTabs.Trigger);
  expect(triggers.find((trigger) => trigger.props.name === "ljod")?.props).toMatchObject({ disablePopToTop: true, disableScrollToTop: true });
  for (const name of ["index", "vit", "miks", "ljod"]) {
    expect(triggers.find((trigger) => trigger.props.name === name)?.props.disableAutomaticContentInsets).toBeFalsy();
  }
});

it("handles Android down/up pairs once and both slider directions", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const onPress = jest.fn();
  const root = render(<HeroBanner heroes={slides} onPress={onPress} />);
  const touchable = root.findByType(TouchableOpacity);
  act(() => {
    touchable.props.onFocus();
  });
  act(() => {
    tvHandler({ eventType: "right", eventKeyAction: 0 });
    tvHandler({ eventType: "right", eventKeyAction: 1 });
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[1]);
  act(() => {
    tvHandler({ eventType: "left", eventKeyAction: 0 });
    tvHandler({ eventType: "left", eventKeyAction: 1 });
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[0]);
});

it("handles consecutive tvOS Ended arrow taps in both directions", () => {
  const onPress = jest.fn();
  const root = render(<HeroBanner heroes={slides} onPress={onPress} />);
  const touchable = root.findByType(TouchableOpacity);
  act(() => {
    touchable.props.onFocus();
  });
  act(() => {
    tvHandler({ eventType: "left", eventKeyAction: 1 });
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[2]);
  act(() => {
    tvHandler({ eventType: "right", eventKeyAction: 1 });
  });
  act(() => {
    touchable.props.onPress();
  });
  expect(onPress).toHaveBeenLastCalledWith(slides[0]);
});

it("returns a radio category to its picker through the focused Back handler", () => {
  const dismissTo = jest.fn();
  jest.mocked(useRouter).mockReturnValue({ dismissTo } as unknown as ReturnType<typeof useRouter>);
  render(<LjodSectionScreen />);
  act(() => {
    jest.mocked(useScreenBack).mock.calls.at(-1)![0]();
  });
  expect(dismissTo).toHaveBeenCalledWith("/(tabs)/ljod");
});

it("gives MiKS heroes with empty slugs independent image cache identities", () => {
  // The live MiKS API returns distinct artwork URLs but empty slugs for its
  // featured episode links. A slug-based cache key aliases every image.
  const heroes = [
    { ...slides[0], slug: "", thumbnailUrl: "https://kvf.fo/kakumiks.png" },
    { ...slides[1], slug: "", thumbnailUrl: "https://kvf.fo/danny.jpg" },
  ];
  const root = render(<HeroBanner heroes={heroes} onPress={jest.fn()} />);
  const images = root.findAllByType(Image);
  expect(images).toHaveLength(2);
  const cacheKeys = images.map((image) => image.props.source.cacheKey ?? image.props.source.uri);
  expect(new Set(cacheKeys).size).toBe(2);
  expect(cacheKeys).toEqual(heroes.map((hero) => hero.thumbnailUrl));
  expect(images.every((image) => image.props.cachePolicy === "memory-disk")).toBe(true);
});

it("updates image identity when artwork changes without replacing the hero focus target", () => {
  const onPress = jest.fn();
  const original = { ...slides[0], thumbnailUrl: "https://kvf.fo/original.jpg" };
  const root = render(<HeroBanner heroes={[original]} onPress={onPress} />);
  const touchable = root.findByType(TouchableOpacity);
  const oldImage = root.findByType(Image).props;
  const oldCacheKey = oldImage.source.cacheKey ?? oldImage.source.uri;
  const updated = { ...original, thumbnailUrl: "https://kvf.fo/replacement.jpg" };
  render(<HeroBanner heroes={[updated]} onPress={onPress} />);
  const nextImage = root.findByType(Image).props;
  expect(nextImage.source.cacheKey ?? nextImage.source.uri).not.toBe(oldCacheKey);
  expect(nextImage.recyclingKey).toBe(updated.thumbnailUrl);
  expect(nextImage.recyclingKey).not.toBe(oldImage.recyclingKey);
  expect(root.findByType(TouchableOpacity)).toBe(touchable);
});
