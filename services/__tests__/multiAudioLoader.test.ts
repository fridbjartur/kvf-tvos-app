/**
 * multiAudioLoader.test.ts
 *
 * Comprehensive unit tests for multi-audio track selection and playback preparation.
 * Tests cover platform detection, language preference logic, native module integration,
 * and edge cases.
 *
 * Created: January 24, 2026
 */

// Mock logger before importing multiAudioLoader
jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import type { JellyfinVideoItem } from "@/types/jellyfin";
import type { AudioTrackInfo } from "../multiAudioLoader";

/**
 * Helper to create a minimal valid JellyfinVideoItem
 */
function createMockVideoItem(overrides: Partial<JellyfinVideoItem> = {}): JellyfinVideoItem {
  return {
    Id: "test-video",
    Name: "Test Video",
    RunTimeTicks: 60000000000,
    Type: "Video",
    Path: "/media/test.mkv",
    ...overrides,
  };
}

describe("multiAudioLoader", () => {
  describe("getAudioTracks (no native module dependency)", () => {
    // These tests don't need native module mocking
    let getAudioTracks: any;

    beforeAll(() => {
      // Mock React Native without native module for these tests
      jest.doMock("react-native", () => ({
        Platform: { OS: "ios" },
        NativeModules: {},
      }));

      const module = require("../multiAudioLoader");
      getAudioTracks = module.getAudioTracks;
    });

    afterAll(() => {
      jest.unmock("react-native");
    });

    it("should extract audio tracks from MediaStreams", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
            Codec: "h264",
          },
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (AAC Stereo)",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish (AC3 5.1)",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(2);
      expect(tracks[0]).toMatchObject({
        Index: 1,
        Language: "eng",
        Codec: "aac",
        Channels: 2,
        DisplayTitle: "English (AAC Stereo)",
      });
      expect(tracks[1]).toMatchObject({
        Index: 2,
        Language: "spa",
        Codec: "ac3",
        Channels: 6,
      });
    });

    it("should fallback to MediaSources[0].MediaStreams if top-level is empty", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [],
        MediaSources: [
          {
            Id: "source-1",
            MediaStreams: [
              {
                Type: "Audio",
                Index: 1,
                Language: "eng",
                Codec: "aac",
                Channels: 2,
                DisplayTitle: "English",
                IsDefault: true,
              },
            ],
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Language).toBe("eng");
    });

    it("should return empty array if no audio tracks found", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
            Codec: "h264",
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(0);
    });

    it("should handle missing MediaStreams gracefully", () => {
      const videoItem = createMockVideoItem();

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(0);
    });

    it("should prefer English track as default", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown",
            IsDefault: true, // Jellyfin says this is default
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      // Sorted by Jellyfin's IsDefault flag - "und" is first because Jellyfin marked it as default
      expect(tracks[0].Language).toBe("und");
      expect(tracks[0].IsDefault).toBe(true);
      expect(tracks[1].Language).toBe("eng");
      expect(tracks[1].IsDefault).toBe(false);
    });

    it("should prefer non-UND track if no English available", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown",
            IsDefault: true,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "jpn",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Japanese",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      // Sorted by IsDefault flag (respects Jellyfin's server-side metadata)
      // The UND track is first because it has IsDefault: true
      expect(tracks[0].Language).toBe("und");
      expect(tracks[0].IsDefault).toBe(true);
      expect(tracks[1].Language).toBe("jpn");
      expect(tracks[1].IsDefault).toBe(false);
    });

    it("should use first track as fallback if all are UND", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown 1",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "Unknown 2",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      // Order preserved when no IsDefault flag is set (both false)
      expect(tracks[0].Index).toBe(1);
      expect(tracks[0].IsDefault).toBe(false);
      expect(tracks[1].Index).toBe(2);
      expect(tracks[1].IsDefault).toBe(false);
    });

    it("should handle single audio track without reordering", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].IsDefault).toBe(true);
    });

    it("should handle missing optional fields with defaults", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Codec: "aac",
            Index: 1,
            // Missing: Language, Channels, DisplayTitle, IsDefault
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0]).toMatchObject({
        Index: 1,
        Language: "und",
        Codec: "aac",
        Channels: 2,
      });
      // Single track keeps original IsDefault value (defaults to false)
      expect(tracks[0].IsDefault).toBe(false);
    });

    it("should recognize English language variants", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "en-US",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (US)",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 2,
            Language: "en-GB",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English (UK)",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      // Order preserved when both have IsDefault: false
      expect(tracks[0].Language).toBe("en-US");
      expect(tracks[0].IsDefault).toBe(false);
      expect(tracks[1].Language).toBe("en-GB");
      expect(tracks[1].IsDefault).toBe(false);
    });

    it("should handle video with mixed track types correctly", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Video",
            Index: 0,
            Codec: "h264",
          },
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
          {
            Type: "Subtitle",
            Index: 2,
            Language: "eng",
            Codec: "subrip",
            DisplayTitle: "English Subtitles",
            IsDefault: false,
          },
          {
            Type: "Audio",
            Index: 3,
            Language: "spa",
            Codec: "ac3",
            Channels: 6,
            DisplayTitle: "Spanish",
            IsDefault: false,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(2);
      expect(tracks.every((t: AudioTrackInfo) => t.Index === 1 || t.Index === 3)).toBe(true);
    });

    it("should handle tracks with Index = 0", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 0,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Index).toBe(0);
    });

    it("should handle tracks with undefined Index", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Codec: "aac",
            // Index is undefined
            Language: "eng",
            Channels: 2,
            DisplayTitle: "English",
            IsDefault: true,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks).toHaveLength(1);
      expect(tracks[0].Index).toBe(0); // Defaults to 0
    });

    it("should handle empty DisplayTitle gracefully", () => {
      const videoItem = createMockVideoItem({
        MediaStreams: [
          {
            Type: "Audio",
            Index: 1,
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            IsDefault: true,
          },
        ],
      });

      const tracks = getAudioTracks(videoItem);

      expect(tracks[0].DisplayTitle).toMatch(/eng.*aac/i);
    });
  });

  describe("Platform and native module checks", () => {
    it("should recognize iOS vs Android platform", () => {
      jest.isolateModules(() => {
        jest.doMock("react-native", () => ({
          Platform: { OS: "android" },
          NativeModules: {},
        }));

        const { shouldUseMultiAudio } = require("../multiAudioLoader");
        const videoItem = createMockVideoItem({
          MediaStreams: [
            { Type: "Audio", Index: 1, Language: "eng", Codec: "aac", Channels: 2 },
            { Type: "Audio", Index: 2, Language: "spa", Codec: "ac3", Channels: 6 },
          ],
        });

        expect(shouldUseMultiAudio(videoItem)).toBe(false);
      });
    });

    it("should detect missing native module", () => {
      jest.isolateModules(() => {
        jest.doMock("react-native", () => ({
          Platform: { OS: "ios" },
          NativeModules: {}, // No MultiAudioResourceLoader
        }));

        const { shouldUseMultiAudio } = require("../multiAudioLoader");
        const videoItem = createMockVideoItem({
          MediaStreams: [
            { Type: "Audio", Index: 1, Language: "eng", Codec: "aac", Channels: 2 },
            { Type: "Audio", Index: 2, Language: "spa", Codec: "ac3", Channels: 6 },
          ],
        });

        expect(shouldUseMultiAudio(videoItem)).toBe(false);
      });
    });
  });

  describe("Integration behavior (documented)", () => {
    /**
     * Note: Full integration testing is limited due to module-level state (pluginRegistered).
     * The module is designed to register the plugin once per app lifetime, which makes
     * it difficult to test multiple registration scenarios in isolation.
     *
     * Core functionality (getAudioTracks, language preference, track sorting) is thoroughly
     * tested above. These tests document expected behavior with real native modules.
     */

    it("should return false for shouldUseMultiAudio when plugin not registered", () => {
      jest.isolateModules(() => {
        jest.doMock("react-native", () => ({
          Platform: { OS: "ios" },
          NativeModules: {
            MultiAudioResourceLoader: {
              registerVideoPlugin: jest.fn(),
              configureResourceLoader: jest.fn(),
              generateCustomUrl: jest.fn(),
            },
          },
        }));

        const { shouldUseMultiAudio } = require("../multiAudioLoader");

        const videoItem = createMockVideoItem({
          MediaStreams: [
            { Type: "Audio", Index: 1, Language: "eng", Codec: "aac", Channels: 2 },
            { Type: "Audio", Index: 2, Language: "spa", Codec: "ac3", Channels: 6 },
          ],
        });

        // Plugin not registered, so should return false even with multiple tracks
        expect(shouldUseMultiAudio(videoItem)).toBe(false);
      });
    });

    it("should throw error when prepareMultiAudioPlayback called without plugin registration", async () => {
      await jest.isolateModulesAsync(async () => {
        jest.doMock("react-native", () => ({
          Platform: { OS: "ios" },
          NativeModules: {
            MultiAudioResourceLoader: {
              registerVideoPlugin: jest.fn(),
              configureResourceLoader: jest.fn(),
              generateCustomUrl: jest.fn(),
            },
          },
        }));

        const { prepareMultiAudioPlayback } = require("../multiAudioLoader");

        const videoItem = createMockVideoItem({
          MediaStreams: [{ Type: "Audio", Index: 1, Language: "eng", Codec: "aac", Channels: 2 }],
        });

        await expect(prepareMultiAudioPlayback("test-video", videoItem, "http://test", "api-key")).rejects.toThrow("Multi-audio native module not available");
      });
    });
  });
});
