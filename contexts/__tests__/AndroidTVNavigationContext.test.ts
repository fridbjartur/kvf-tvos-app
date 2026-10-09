import { ANDROID_TV_NAV_HEIGHT, createAndroidTVNavigation } from "../AndroidTVNavigationContext";
import { tvSize } from "@/utils/tvLayout";

const scrolledAway = tvSize(ANDROID_TV_NAV_HEIGHT);
const screen = () => ({ scrollToTop: jest.fn() });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("follows the focused screen's offset and keeps the bar for screens without one", () => {
  const navigation = createAndroidTVNavigation();
  const listener = jest.fn();
  navigation.subscribe(listener);
  const home = screen();
  navigation.reportOffset(home, scrolledAway);
  const leaveHome = navigation.activate(home);
  expect(navigation.isScrolledAway()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);

  // An inactive screen's late offset report cannot move the bar.
  const vit = screen();
  leaveHome();
  expect(navigation.isScrolledAway()).toBe(false);
  navigation.activate(vit);
  navigation.reportOffset(home, scrolledAway);
  expect(navigation.isScrolledAway()).toBe(false);
  navigation.reportOffset(vit, scrolledAway);
  expect(navigation.isScrolledAway()).toBe(true);
  // Returning to a screen restores the bar to that screen's offset.
  navigation.activate(home);
  expect(navigation.isScrolledAway()).toBe(true);
});

it("shows a newly selected tab from its top while the bar has focus", () => {
  const navigation = createAndroidTVNavigation();
  navigation.tabFocused();
  const miks = screen();
  navigation.reportOffset(miks, 900);
  navigation.activate(miks);
  expect(miks.scrollToTop).toHaveBeenCalledWith(false);
  expect(navigation.isScrolledAway()).toBe(false);
});

it("tells focus moving along the bar from focus arriving from outside it", () => {
  const navigation = createAndroidTVNavigation();
  expect(navigation.tabFocused()).toBe(false);
  navigation.tabBlurred();
  expect(navigation.tabFocused()).toBe(true);
  navigation.tabBlurred();
  jest.advanceTimersByTime(1000);
  expect(navigation.tabFocused()).toBe(false);
});

it("reveals the bar for Back, ignoring offsets reported while the screen scrolls up", () => {
  const navigation = createAndroidTVNavigation();
  const home = screen();
  navigation.reportOffset(home, 2000);
  navigation.activate(home);
  const request = navigation.focusRequest();
  navigation.focusBar();
  expect(home.scrollToTop).toHaveBeenCalledWith(true);
  expect(navigation.focusRequest()).toBe(request + 1);
  expect(navigation.isScrolledAway()).toBe(false);
  navigation.reportOffset(home, 1500);
  expect(navigation.isScrolledAway()).toBe(false);
  // Once the bar has focus, offsets apply again.
  navigation.tabFocused();
  navigation.reportOffset(home, 1000);
  expect(navigation.isScrolledAway()).toBe(true);
  expect(navigation.isBarFocused()).toBe(true);
});
