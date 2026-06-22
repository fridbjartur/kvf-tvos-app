import { getProgress, saveProgress, clearProgress, clearAllProgress, getRecentProgress, _resetForTesting } from "../watchProgressService";

// Mock expo-secure-store
const mockStore: Record<string, string> = {};

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

// Import mocked module for assertions
import * as SecureStore from "expo-secure-store";

beforeEach(() => {
  // Clear mock store and reset service cache between tests
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key];
  }
  _resetForTesting();
  jest.clearAllMocks();
});

describe("watchProgressService", () => {
  describe("basic CRUD", () => {
    it("returns null when no progress exists", async () => {
      const result = await getProgress("video-1");
      expect(result).toBeNull();
    });

    it("saves and retrieves progress", async () => {
      await saveProgress("video-1", 120, 3600);
      const result = await getProgress("video-1");

      expect(result).not.toBeNull();
      expect(result!.position).toBe(120);
      expect(result!.duration).toBe(3600);
      expect(result!.updatedAt).toBeGreaterThan(0);
    });

    it("clears progress for a single video", async () => {
      await saveProgress("video-1", 120, 3600);
      await saveProgress("video-2", 300, 7200);

      await clearProgress("video-1");

      expect(await getProgress("video-1")).toBeNull();
      expect(await getProgress("video-2")).not.toBeNull();
    });

    it("clears all progress", async () => {
      await saveProgress("video-1", 120, 3600);
      await saveProgress("video-2", 300, 7200);

      await clearAllProgress();

      expect(await getProgress("video-1")).toBeNull();
      expect(await getProgress("video-2")).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("watch_progress_data");
    });

    it("overwrites existing progress on save", async () => {
      await saveProgress("video-1", 120, 3600);
      await saveProgress("video-1", 600, 3600);

      const result = await getProgress("video-1");
      expect(result!.position).toBe(600);
    });
  });

  describe("threshold checks", () => {
    it("skips save when position below the minimum (4s)", async () => {
      await saveProgress("video-1", 2, 3600);
      expect(await getProgress("video-1")).toBeNull();
    });

    it("saves when position is exactly the minimum (4s)", async () => {
      await saveProgress("video-1", 4, 3600);
      expect(await getProgress("video-1")).not.toBeNull();
    });

    it("clears entry when position/duration >= 95%", async () => {
      // First save valid progress
      await saveProgress("video-1", 120, 3600);
      expect(await getProgress("video-1")).not.toBeNull();

      // Then save with 95% completion — should clear
      await saveProgress("video-1", 3420, 3600);
      expect(await getProgress("video-1")).toBeNull();
    });

    it("clears entry when position equals duration", async () => {
      await saveProgress("video-1", 120, 3600);
      await saveProgress("video-1", 3600, 3600);
      expect(await getProgress("video-1")).toBeNull();
    });

    it("does not clear when position/duration < 95%", async () => {
      await saveProgress("video-1", 3000, 3600); // ~83%
      expect(await getProgress("video-1")).not.toBeNull();
    });

    it("handles zero duration gracefully (no division by zero)", async () => {
      // position >= 60 but duration is 0 — the completion check (position/0) is Infinity >= 0.95, so it should clear
      await saveProgress("video-1", 120, 0);
      // With duration 0, position/duration is Infinity which is >= 0.95, so entry is cleared
      // But the guard `duration > 0` prevents this — entry should be saved
      const result = await getProgress("video-1");
      expect(result).not.toBeNull();
      expect(result!.position).toBe(120);
    });
  });

  describe("pruning stale entries", () => {
    it("prunes entries older than 30 days on load", async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      // Pre-populate store with stale and fresh entries
      mockStore["watch_progress_data"] = JSON.stringify({
        "old-video": { position: 100, duration: 3600, updatedAt: thirtyOneDaysAgo },
        "fresh-video": { position: 200, duration: 7200, updatedAt: twoDaysAgo },
      });

      // First access triggers load + prune
      const oldResult = await getProgress("old-video");
      const freshResult = await getProgress("fresh-video");

      expect(oldResult).toBeNull();
      expect(freshResult).not.toBeNull();
      expect(freshResult!.position).toBe(200);
    });
  });

  describe("corrupt JSON recovery", () => {
    it("resets to empty cache on corrupt JSON in SecureStore", async () => {
      mockStore["watch_progress_data"] = "not valid json {{{";

      // Should not throw — recovers gracefully
      const result = await getProgress("video-1");
      expect(result).toBeNull();

      // Should be able to save new progress after recovery
      await saveProgress("video-1", 120, 3600);
      expect(await getProgress("video-1")).not.toBeNull();
    });
  });

  describe("concurrent loads", () => {
    it("deduplicates concurrent ensureCacheLoaded calls", async () => {
      mockStore["watch_progress_data"] = JSON.stringify({
        "video-1": { position: 100, duration: 3600, updatedAt: Date.now() },
      });

      // Fire multiple concurrent reads
      const [r1, r2, r3] = await Promise.all([getProgress("video-1"), getProgress("video-1"), getProgress("video-1")]);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r3).not.toBeNull();

      // SecureStore.getItemAsync should only be called once for the cache load
      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("write failures", () => {
    it("does not throw on SecureStore write failure", async () => {
      // First load succeeds normally
      await getProgress("video-1");

      // Now make setItemAsync fail
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("SecureStore write failed"));

      // Should not throw
      await expect(saveProgress("video-1", 120, 3600)).resolves.not.toThrow();

      // In-memory cache should still have the value
      const result = await getProgress("video-1");
      expect(result).not.toBeNull();
      expect(result!.position).toBe(120);
    });

    it("does not throw on SecureStore delete failure in clearAllProgress", async () => {
      await saveProgress("video-1", 120, 3600);

      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error("delete failed"));

      await expect(clearAllProgress()).resolves.not.toThrow();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entries when cache exceeds MAX_ENTRIES (50)", async () => {
      const now = Date.now();

      // Pre-populate store with 50 entries
      const entries: Record<string, { position: number; duration: number; updatedAt: number }> = {};
      for (let i = 0; i < 50; i++) {
        entries[`video-${i}`] = {
          position: 120,
          duration: 3600,
          updatedAt: now - (50 - i) * 1000, // oldest first
        };
      }
      mockStore["watch_progress_data"] = JSON.stringify(entries);

      // Load cache by reading any entry
      await getProgress("video-0");

      // Save a 51st entry — should evict the oldest (video-0)
      await saveProgress("video-new", 300, 7200);

      // video-0 was the oldest, should be evicted
      expect(await getProgress("video-0")).toBeNull();

      // video-new should exist
      const newEntry = await getProgress("video-new");
      expect(newEntry).not.toBeNull();
      expect(newEntry!.position).toBe(300);

      // video-49 (most recent of the originals) should still exist
      expect(await getProgress("video-49")).not.toBeNull();

      // Total entries should be exactly 50
      const persisted = JSON.parse(mockStore["watch_progress_data"]);
      expect(Object.keys(persisted).length).toBe(50);
    });
  });

  describe("getRecentProgress", () => {
    it("returns entries sorted by updatedAt descending (most recent first)", async () => {
      const now = Date.now();
      mockStore["watch_progress_data"] = JSON.stringify({
        "video-old": { position: 100, duration: 3600, updatedAt: now - 3000 },
        "video-new": { position: 200, duration: 3600, updatedAt: now - 1000 },
        "video-mid": { position: 150, duration: 3600, updatedAt: now - 2000 },
      });

      const recent = await getRecentProgress();

      expect(recent.map((e) => e.videoId)).toEqual(["video-new", "video-mid", "video-old"]);
      expect(recent[0]).toMatchObject({ videoId: "video-new", position: 200, duration: 3600 });
    });

    it("drops near-finished entries (>= 95% watched)", async () => {
      const now = Date.now();
      mockStore["watch_progress_data"] = JSON.stringify({
        "video-partial": { position: 1800, duration: 3600, updatedAt: now }, // 50%
        "video-done": { position: 3500, duration: 3600, updatedAt: now }, // ~97%
      });

      const recent = await getRecentProgress();

      expect(recent.map((e) => e.videoId)).toEqual(["video-partial"]);
    });

    it("respects the limit argument", async () => {
      const now = Date.now();
      const entries: Record<string, { position: number; duration: number; updatedAt: number }> = {};
      for (let i = 0; i < 10; i++) {
        entries[`video-${i}`] = { position: 120, duration: 3600, updatedAt: now - i * 1000 };
      }
      mockStore["watch_progress_data"] = JSON.stringify(entries);

      const recent = await getRecentProgress(3);

      expect(recent).toHaveLength(3);
      expect(recent.map((e) => e.videoId)).toEqual(["video-0", "video-1", "video-2"]);
    });

    it("returns an empty array when there is no progress", async () => {
      expect(await getRecentProgress()).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("persists to SecureStore on save", async () => {
      await saveProgress("video-1", 120, 3600);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("watch_progress_data", expect.any(String));

      // Verify the persisted data is correct
      const persisted = JSON.parse(mockStore["watch_progress_data"]);
      expect(persisted["video-1"].position).toBe(120);
    });

    it("survives service reset (simulating app restart)", async () => {
      await saveProgress("video-1", 120, 3600);

      // Simulate app restart
      _resetForTesting();

      const result = await getProgress("video-1");
      expect(result).not.toBeNull();
      expect(result!.position).toBe(120);
    });
  });
});
