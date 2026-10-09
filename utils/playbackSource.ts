import { Platform } from "react-native";

/** Android infers the format before following KVF's .smil?type=m3u8 redirect. */
export function playbackSource(uri: string) {
  const hls = /\.m3u8(?:[?#]|$)|[?&]type=m3u8(?:[&#]|$)/i.test(uri);
  return Platform.OS === "android" && hls ? { uri, type: "m3u8" } : { uri };
}
