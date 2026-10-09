import { Dimensions, Platform } from "react-native";
import { tvSize } from "../tvLayout";

const os = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const tv = Object.getOwnPropertyDescriptor(Platform, "isTV")!;
afterEach(() => {
  Object.defineProperty(Platform, "OS", os);
  Object.defineProperty(Platform, "isTV", tv);
  jest.restoreAllMocks();
});

it.each([960, 1280, 1920])("fits the Android TV design to a %i dp window", (width) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  Object.defineProperty(Platform, "isTV", { configurable: true, value: true });
  jest.spyOn(Dimensions, "get").mockReturnValue({ width, height: (width * 9) / 16, scale: 2, fontScale: 1 });
  expect(tvSize(360)).toBe((360 * width) / 1920);
  expect(tvSize(-80)).toBeCloseTo((-80 * width) / 1920);
});

it.each([
  ["ios", true],
  ["android", false],
])("preserves dimensions on %s with isTV=%s", (platform, isTV) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: platform });
  Object.defineProperty(Platform, "isTV", { configurable: true, value: isTV });
  expect(tvSize(360)).toBe(360);
});
