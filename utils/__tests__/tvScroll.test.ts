import { Platform } from "react-native";
import { tvRowScrollProps, tvScreenScrollProps, tvSnap } from "../tvScroll";
import { isRemotePress } from "../tvRemote";
import { tvSize } from "../tvLayout";

const os = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const tv = Object.getOwnPropertyDescriptor(Platform, "isTV")!;
function setPlatform(value: string, isTV: boolean) {
  Object.defineProperty(Platform, "OS", { configurable: true, value });
  Object.defineProperty(Platform, "isTV", { configurable: true, value: isTV });
}
afterEach(() => {
  Object.defineProperty(Platform, "OS", os);
  Object.defineProperty(Platform, "isTV", tv);
});

it("leaves one native focus-scroll animation active on Android TV", () => {
  setPlatform("android", true);
  // Shelves: Android's smooth arrowScroll only, with the fading edge as its margin.
  expect(tvRowScrollProps()).toEqual({ scrollsChildToFocus: false, fadingEdgeLength: tvSize(60) });
  // Screens: focus snapping only; arrowScroll is disabled with user scrolling.
  expect(tvScreenScrollProps(88)).toEqual({ scrollEnabled: false, snapToAlignment: "item", snapToItemPadding: 88 });
  // Snap targets must survive view flattening.
  expect(tvSnap()).toEqual({ scrollSnapAlign: "start", collapsable: false });
  expect(tvSnap("center")).toEqual({ scrollSnapAlign: "center", collapsable: false });
});

it.each([
  ["ios", true],
  ["android", false],
])("keeps the platform's own scrolling on %s with isTV=%s", (platform, isTV) => {
  setPlatform(platform, isTV);
  expect(tvRowScrollProps()).toEqual({});
  expect(tvScreenScrollProps(88)).toEqual({});
  expect(tvSnap("end")).toEqual({});
});

it("counts one Android press on release and every tvOS tap", () => {
  setPlatform("android", true);
  expect(isRemotePress({ eventType: "right", eventKeyAction: 0 }, "right")).toBe(false);
  expect(isRemotePress({ eventType: "right", eventKeyAction: 1 }, "right")).toBe(true);
  expect(isRemotePress({ eventType: "longRight", eventKeyAction: 1 }, "right")).toBe(false);
  setPlatform("ios", true);
  expect(isRemotePress({ eventType: "left", eventKeyAction: 1 }, "left")).toBe(true);
  expect(isRemotePress({ eventType: "left", eventKeyAction: 1 }, "right")).toBe(false);
});
