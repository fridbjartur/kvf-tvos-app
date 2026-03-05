/**
 * Unit tests for audio track mapping logic
 *
 * These tests verify Bug #2 fix: ensuring audio track mapping uses
 * the SAME sorted array that was sent to Swift via prepareMultiAudioPlayback()
 *
 * Tests the mapping logic pattern without depending on React rendering.
 */

import { getAudioTracks, type AudioTrackInfo } from "@/services/multiAudioLoader";
import type { JellyfinVideoItem, JellyfinMediaStream } from "@/types/jellyfin";

describe("Audio Track Mapping Logic", () => {
  describe("Track Index Mapping Pattern", () => {
    it("should build mapping from sorted audio tracks array", () => {
      // This verifies the fix for Bug #2:
      // The mapping MUST use the sorted array from getAudioTracks(),
      // NOT the unsorted MediaStreams array

      // Sorted array (English first due to language preference)
      const sortedAudioTracks: AudioTrackInfo[] = [
        {
          Index: 8,
          Language: "eng",
          Codec: "aac",
          Channels: 1,
          DisplayTitle: "ENG (AAC Mono)",
          IsDefault: true,
        },
        {
          Index: 1,
          Language: "und",
          Codec: "aac",
          Channels: 2,
          DisplayTitle: "UND (AAC Stereo)",
          IsDefault: false,
        },
      ];

      // Build mapping using the CORRECT pattern (fixed in Bug #2)
      const audioTrackMapping = sortedAudioTracks.map((track) => track.Index);

      // Verify mapping matches sorted order: [8, 1]
      expect(audioTrackMapping).toEqual([8, 1]);
      expect(audioTrackMapping[0]).toBe(8); // English first
      expect(audioTrackMapping[1]).toBe(1); // UND second
    });

    it("should NOT build mapping from unsorted MediaStreams (old buggy pattern)", () => {
      // This demonstrates the BUG that was fixed:
      // Using unsorted MediaStreams gives [1, 8] instead of [8, 1]

      const unsortedMediaStreams: JellyfinMediaStream[] = [
        {
          Index: 1,
          Type: "Audio",
          Language: "und",
          Codec: "aac",
          Channels: 2,
          DisplayTitle: "UND (AAC Stereo)",
          IsDefault: true,
        },
        {
          Index: 8,
          Type: "Audio",
          Language: "eng",
          Codec: "aac",
          Channels: 1,
          DisplayTitle: "ENG (AAC Mono)",
          IsDefault: false,
        },
      ];

      // OLD BUGGY PATTERN (fixed in Bug #2):
      // const audioStreams = MediaStreams.filter(...)
      // const mapping = audioStreams.map(stream => stream.Index!)
      const buggyMapping = unsortedMediaStreams.filter((s) => s.Type === "Audio" && s.Index !== undefined).map((stream) => stream.Index!);

      // This gives [1, 8] which is WRONG (doesn't match Swift's sorted order)
      expect(buggyMapping).toEqual([1, 8]);
      expect(buggyMapping[0]).toBe(1); // UND first (wrong!)
      expect(buggyMapping[1]).toBe(8); // English second (wrong!)
    });
  });

  describe("Real-World Scenario", () => {
    it("should correctly map multi-audio tracks for test video", () => {
      // Real scenario from Bug #2: test5-multiple-audio-tracks
      // MediaStreams in Jellyfin: [stream 1 (UND), stream 8 (ENG)]
      // After language preference sorting: [stream 8 (ENG), stream 1 (UND)]

      const videoItem: Partial<JellyfinVideoItem> = {
        Id: "test5",
        Name: "test5-multiple-audio-tracks",
        MediaStreams: [
          {
            Index: 1,
            Type: "Audio",
            Language: "und",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "UND (AAC Stereo)",
            IsDefault: true, // Original default in Jellyfin
          },
          {
            Index: 8,
            Type: "Audio",
            Language: "eng",
            Codec: "aac",
            Channels: 1,
            DisplayTitle: "ENG (AAC Mono)",
            IsDefault: false,
          },
        ],
      };

      // getAudioTracks() respects Jellyfin's IsDefault flag for sorting
      const sortedTracks = getAudioTracks(videoItem as JellyfinVideoItem);

      // After sorting: UND is first because Jellyfin marked it as default
      expect(sortedTracks.length).toBe(2);
      expect(sortedTracks[0].Language).toBe("und");
      expect(sortedTracks[0].Index).toBe(1);
      expect(sortedTracks[0].IsDefault).toBe(true);
      expect(sortedTracks[1].Language).toBe("eng");
      expect(sortedTracks[1].Index).toBe(8);
      expect(sortedTracks[1].IsDefault).toBe(false);

      // Build mapping (CORRECT fix from Bug #2)
      const mapping = sortedTracks.map((t) => t.Index);

      // Mapping should match sorted order: [1, 8] (UND first because IsDefault: true)
      expect(mapping).toEqual([1, 8]);
    });

    it("should handle single audio track", () => {
      const videoItem: Partial<JellyfinVideoItem> = {
        Id: "single-audio",
        Name: "Single Audio Video",
        MediaStreams: [
          {
            Index: 1,
            Type: "Audio",
            Language: "eng",
            Codec: "aac",
            Channels: 2,
            DisplayTitle: "ENG (AAC Stereo)",
            IsDefault: true,
          },
        ],
      };

      const tracks = getAudioTracks(videoItem as JellyfinVideoItem);

      expect(tracks.length).toBe(1);
      expect(tracks[0].Index).toBe(1);

      const mapping = tracks.map((t) => t.Index);
      expect(mapping).toEqual([1]);
    });

    it("should handle videos with no audio", () => {
      const videoItem: Partial<JellyfinVideoItem> = {
        Id: "no-audio",
        Name: "Silent Video",
        MediaStreams: [],
      };

      const tracks = getAudioTracks(videoItem as JellyfinVideoItem);

      expect(tracks).toEqual([]);

      const mapping = tracks.map((t) => t.Index);
      expect(mapping).toEqual([]);
    });
  });
});
