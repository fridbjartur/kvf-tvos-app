import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BackHandler, TVFocusGuideView } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { AndroidTVTabBar } from "../android-tv-tab-bar";
import { AndroidTVNavigationContext, ANDROID_TV_NAV_HEIGHT, createAndroidTVNavigation, type AndroidTVNavigation } from "@/contexts/AndroidTVNavigationContext";
import { tvSize } from "@/utils/tvLayout";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));

const navigate = jest.fn();
const emit = jest.fn(() => ({ defaultPrevented: false }));
const props = {
  state: { index: 3, routes: ["index", "vit", "miks", "ljod", "schedule", "search"].map((name) => ({ key: name, name })) },
  navigation: { navigate, emit },
} as unknown as BottomTabBarProps;
const requestTVFocus = jest.fn();
let backHandler: () => boolean | null | undefined;
let renderer: TestRenderer.ReactTestRenderer;
let navigation: AndroidTVNavigation;

function render() {
  const element = (
    <AndroidTVNavigationContext value={navigation}>
      <AndroidTVTabBar {...props} />
    </AndroidTVNavigationContext>
  );
  act(() => {
    if (renderer) renderer.update(element);
    else renderer = TestRenderer.create(element);
  });
  // Jest's native View mock does not implement the TV focus command.
  tabs()[3].props.ref.current.requestTVFocus = requestTVFocus;
}
function back() {
  let handled: boolean | null | undefined;
  act(() => {
    handled = backHandler();
  });
  return handled;
}
function tabs() {
  return renderer.root.findAll((node) => node.props.accessibilityRole === "tab" && typeof node.props.onFocus === "function", { deep: false });
}
function focus(index: number) {
  act(() => tabs()[index].props.onFocus());
}
function blur(index: number) {
  act(() => tabs()[index].props.onBlur());
}
const screen = { scrollToTop: jest.fn() };

beforeEach(() => {
  mockFocused = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  emit.mockReturnValue({ defaultPrevented: false });
  navigation = createAndroidTVNavigation();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
    backHandler = handler;
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined!;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("starts on the selected tab and selects tabs as focus moves along the bar, as on tvOS", () => {
  render();
  expect(tabs()).toHaveLength(6);
  expect(tabs()[3].props.accessibilityState.selected).toBe(true);
  expect(
    tabs()
      .filter((tab) => tab.props.hasTVPreferredFocus)
      .map((tab) => tab.props.accessibilityLabel),
  ).toEqual([tabs()[3].props.accessibilityLabel]);
  focus(3);
  expect(navigate).not.toHaveBeenCalled();
  // Android delivers the previous tab's blur just before the next tab's focus.
  blur(3);
  focus(4);
  expect(emit).toHaveBeenCalledWith({ type: "tabPress", target: "schedule", canPreventDefault: true });
  expect(navigate).toHaveBeenCalledWith("schedule", undefined);
  // Only the app's first screen starts on the bar.
  expect(tabs().some((tab) => tab.props.hasTVPreferredFocus)).toBe(false);
});

it("never changes tabs when focus enters the bar from content or Android's focus recovery", () => {
  render();
  // A pushed or popped screen removes the focused view; Android recovers to the first tab.
  focus(0);
  expect(navigate).not.toHaveBeenCalled();
  act(() => jest.runAllTimers());
  // Nothing else claimed focus, so it moves to the selected tab.
  expect(requestTVFocus).toHaveBeenCalledTimes(1);

  requestTVFocus.mockClear();
  blur(0);
  act(() => jest.advanceTimersByTime(1000));
  focus(1);
  // The returning screen restores its own focus first.
  blur(1);
  act(() => jest.runAllTimers());
  expect(requestTVFocus).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

it("keeps the radio category when its tab is focused again and honors prevented switches", () => {
  render();
  focus(3);
  expect(emit).not.toHaveBeenCalled();
  emit.mockReturnValue({ defaultPrevented: true });
  blur(3);
  focus(2);
  expect(emit).toHaveBeenCalledWith({ type: "tabPress", target: "miks", canPreventDefault: true });
  expect(navigate).not.toHaveBeenCalled();
});

it("returns Back from content to the bar at the top of the screen, then lets Android leave the app", () => {
  render();
  navigation.reportOffset(screen, 400);
  const cleanup = navigation.activate(screen);
  expect(back()).toBe(true);
  expect(screen.scrollToTop).toHaveBeenCalledWith(true);
  act(() => jest.runAllTimers());
  expect(requestTVFocus).toHaveBeenCalledTimes(1);
  focus(3);
  expect(back()).toBe(false);
  cleanup();
});

it("leaves the focus order once scrolled away, and while a detail or player covers the tabs", () => {
  render();
  const cleanup = navigation.activate(screen);
  expect(renderer.root.findByType(TVFocusGuideView).props.focusable).toBe(true);
  act(() => navigation.reportOffset(screen, tvSize(ANDROID_TV_NAV_HEIGHT)));
  expect(renderer.root.findByType(TVFocusGuideView).props.focusable).toBe(false);
  expect(tabs().every((tab) => tab.props.disabled)).toBe(true);
  act(() => navigation.reportOffset(screen, 0));
  expect(tabs().some((tab) => tab.props.disabled)).toBe(false);
  mockFocused = false;
  render();
  expect(renderer.root.findByType(TVFocusGuideView).props.focusable).toBe(false);
  expect(back()).toBe(false);
  cleanup();
});

it("keeps a screen's scroll position when focus recovery briefly lands on the bar", () => {
  render();
  const cleanup = navigation.activate(screen);
  // Returning from a program: recovery reaches the bar, then the screen restores its card.
  focus(3);
  blur(3);
  act(() => jest.runAllTimers());
  expect(screen.scrollToTop).not.toHaveBeenCalled();
  // Up from the top of the screen: focus stays, so the screen settles at its top.
  act(() => jest.advanceTimersByTime(1000));
  focus(3);
  act(() => jest.runAllTimers());
  expect(screen.scrollToTop).toHaveBeenCalledWith(true);
  cleanup();
});
