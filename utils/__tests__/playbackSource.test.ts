import { Platform } from "react-native";
import { playbackSource } from "../playbackSource";

const os = Object.getOwnPropertyDescriptor(Platform, "OS")!;
afterEach(() => Object.defineProperty(Platform, "OS", os));

it.each([
  "https://vod.kringvarp.fo/redirect/video/_definst_/smil:smil/video/episode.smil?type=m3u8",
  "https://example.com/video.smil?token=public&type=m3u8&other=value",
  "https://example.com/playlist.m3u8",
  "https://example.com/playlist.m3u8?token=public",
])("explicitly selects native HLS on Android for %s", (uri) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  expect(playbackSource(uri)).toEqual({ uri, type: "m3u8" });
});

it.each(["http://netvarp.kringvarp.fo:443/utvarp", "https://example.com/audio.aac", "https://example.com/audio.mp3", "https://example.com/video.mp4", ""])(
  "preserves native format detection for %s",
  (uri) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    expect(playbackSource(uri)).toEqual({ uri });
  },
);

it("preserves AVPlayer format detection on Apple TV", () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  const uri = "https://vod.kringvarp.fo/video.smil?type=m3u8";
  expect(playbackSource(uri)).toEqual({ uri });
});
