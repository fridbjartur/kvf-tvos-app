import {
  _resetForTesting,
  clearWatchHistory,
  flushWatchProgress,
  getContinueWatching,
  getContinueWatchingEntry,
  getEpisodeProgress,
  getResumePosition,
  markCompleted,
  recordProgress,
  removeFromContinueWatching,
  startWatchProgressSync,
  subscribeWatchProgress,
  type WatchTarget,
} from "../watchProgressService";
import { AppState } from "react-native";

// One in-memory value stands in for NSUserDefaults. `mockLoad` lets a test
// swap in the asynchronous (Android file) behaviour.
let mockStored: string | null = null;
const mockLoad = jest.fn((): string | null | Promise<string | null> => mockStored);
const mockSave = jest.fn(async (raw: string) => {
  mockStored = raw;
});
const mockClear = jest.fn(async () => {
  mockStored = null;
});
jest.mock("../watchProgressStorage", () => ({
  watchProgressStorage: { load: () => mockLoad(), save: (raw: string) => mockSave(raw), clear: () => mockClear() },
}));

const DAY = 24 * 60 * 60 * 1000;

function episode(sid: string, overrides: Partial<WatchTarget> = {}): WatchTarget {
  return { section: "sjon", slug: "show", sid, programTitle: "Show", episodeTitle: `Episode ${sid}`, thumbnailUrl: `https://kvf.fo/${sid}.jpg`, ...overrides };
}

function stored() {
  return JSON.parse(mockStored ?? "null");
}

beforeEach(() => {
  mockStored = null;
  _resetForTesting();
  jest.clearAllMocks();
  mockLoad.mockImplementation(() => mockStored);
});

afterEach(() => {
  // Also cancels the pending persist timer, so no write outlives its test.
  _resetForTesting();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("recording progress", () => {
  it("stores position and full duration per episode", () => {
    recordProgress(episode("1"), 120.4, 1800.2);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ position: 120, duration: 1800, completed: false });
  });

  it("ignores positions before the minimum so a stray sample never erases progress", () => {
    recordProgress(episode("1"), 8, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeUndefined();

    recordProgress(episode("1"), 600, 1800);
    recordProgress(episode("1"), 0.3, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(600);
  });

  it("records an episode from the minimum on", () => {
    recordProgress(episode("1"), 10, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ position: 10, completed: false });
    expect(getContinueWatchingEntry("sjon", "show")?.sid).toBe("1");
  });

  it("keeps the last known duration when the player reports none", () => {
    recordProgress(episode("1"), 120, 1800);
    recordProgress(episode("1"), 240, Number.NaN);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ position: 240, duration: 1800 });
  });

  it("does not notify subscribers when nothing changed", () => {
    recordProgress(episode("1"), 120, 1800);
    const listener = jest.fn();
    subscribeWatchProgress(listener);
    recordProgress(episode("1"), 120.2, 1800);
    expect(listener).not.toHaveBeenCalled();
    recordProgress(episode("1"), 130, 1800);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("replaces only the changed entry, so other cards keep their snapshot", () => {
    recordProgress(episode("1"), 120, 1800);
    recordProgress(episode("2"), 120, 1800);
    const first = getEpisodeProgress("sjon", "show", "1");
    recordProgress(episode("2"), 300, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toBe(first);
  });

  it("rejects targets without an episode identity or a known section", () => {
    recordProgress(episode(""), 120, 1800);
    recordProgress(episode("1", { section: "nope" as WatchTarget["section"] }), 120, 1800);
    expect(getContinueWatching()).toEqual([]);
  });
});

describe("completion", () => {
  it("marks an episode watched past 95% and moves its card on to the next episode", () => {
    recordProgress(episode("1"), 600, 1800);
    recordProgress(episode("1"), 1720, 1800, episode("2"));

    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ completed: true, position: 1800, duration: 1800 });
    expect(getContinueWatchingEntry("sjon", "show")).toMatchObject({ sid: "2", episodeTitle: "Episode 2" });
    expect(getResumePosition("sjon", "show", "1")).toBeNull();
  });

  it("removes the program from the row after its last episode", () => {
    recordProgress(episode("1"), 600, 1800);
    markCompleted(episode("1"), 1800, null);
    expect(getContinueWatching()).toEqual([]);
    expect(getEpisodeProgress("sjon", "show", "1")?.completed).toBe(true);
  });

  it("keeps the next episode under the current program's card", () => {
    recordProgress(episode("1"), 600, 1800);
    markCompleted(episode("1"), 1800, episode("2", { slug: "episode-slug", programTitle: "" }));
    expect(getContinueWatching()).toHaveLength(1);
    expect(getContinueWatchingEntry("sjon", "show")).toMatchObject({ sid: "2", slug: "show", programTitle: "Show" });
  });

  it("ignores repeated completion reports from the credits", () => {
    markCompleted(episode("1"), 1800, episode("2"));
    const listener = jest.fn();
    subscribeWatchProgress(listener);
    recordProgress(episode("1"), 1760, 1800, episode("2"));
    recordProgress(episode("1"), 1790, 1800, episode("2"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the Watched badge when a finished episode is only sampled again", () => {
    markCompleted(episode("1"), 1800, null);
    recordProgress(episode("1"), 12, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")?.completed).toBe(true);
    expect(getContinueWatching()).toEqual([]);
  });

  it("returns a rewatched episode to in-progress", () => {
    markCompleted(episode("1"), 1800, null);
    recordProgress(episode("1"), 60, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ completed: false, position: 60 });
    expect(getContinueWatchingEntry("sjon", "show")?.sid).toBe("1");
  });
});

describe("resume", () => {
  it("resumes slightly before the saved position", () => {
    recordProgress(episode("1"), 600, 1800);
    expect(getResumePosition("sjon", "show", "1")).toBe(597);
  });

  it("starts unwatched and finished episodes from the beginning", () => {
    expect(getResumePosition("sjon", "show", "1")).toBeNull();
    markCompleted(episode("2"), 1800);
    expect(getResumePosition("sjon", "show", "2")).toBeNull();
  });
});

describe("continue watching row", () => {
  it("shows one card per program, most recently watched first", () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    recordProgress(episode("1"), 120, 1800);
    now.mockReturnValue(2_000_000);
    recordProgress(episode("a", { slug: "other", programTitle: "Other" }), 120, 1800);
    now.mockReturnValue(3_000_000);
    recordProgress(episode("2"), 120, 1800);

    expect(getContinueWatching().map((entry) => `${entry.slug}:${entry.sid}`)).toEqual(["show:2", "other:a"]);
    now.mockRestore();
  });

  it("keeps the row's identity until a program changes", () => {
    recordProgress(episode("1"), 120, 1800);
    const row = getContinueWatching();
    recordProgress(episode("1"), 180, 1800);
    expect(getContinueWatching()).toBe(row);
    recordProgress(episode("x", { slug: "other" }), 120, 1800);
    expect(getContinueWatching()).not.toBe(row);
  });

  it("keeps known artwork and titles when a later report lacks them", () => {
    recordProgress(episode("1"), 120, 1800);
    recordProgress(episode("1", { thumbnailUrl: null, programTitle: "" }), 400, 1800);
    expect(getContinueWatchingEntry("sjon", "show")).toMatchObject({ thumbnailUrl: "https://kvf.fo/1.jpg", programTitle: "Show" });
  });

  it("caps the row at twenty cards", () => {
    for (let i = 0; i < 25; i++) recordProgress(episode("1", { slug: `show-${i}` }), 120, 1800);
    expect(getContinueWatching()).toHaveLength(20);
  });

  it("removes a program on request but keeps its progress", () => {
    recordProgress(episode("1"), 120, 1800);
    removeFromContinueWatching("sjon", "show");
    expect(getContinueWatching()).toEqual([]);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeDefined();
  });

  it("drops programs untouched for 90 days when history loads", () => {
    const now = Date.now();
    mockStored = JSON.stringify({
      v: 1,
      episodes: {},
      programs: {
        "sjon:old": { ...episode("1", { slug: "old" }), updatedAt: now - 91 * DAY },
        "sjon:fresh": { ...episode("2", { slug: "fresh" }), updatedAt: now - 2 * DAY },
      },
    });
    expect(getContinueWatching().map((entry) => entry.slug)).toEqual(["fresh"]);
  });
});

describe("limits", () => {
  it("evicts the oldest episodes past the budget but never one a card points at", () => {
    const now = Date.now();
    const episodes: Record<string, object> = {};
    for (let i = 0; i < 600; i++) episodes[`sjon:show:${i}`] = { position: 60, duration: 1800, completed: false, updatedAt: now - (1000 - i) * 1000 };
    mockStored = JSON.stringify({ v: 1, episodes, programs: { "sjon:show": { ...episode("0"), updatedAt: now } } });

    recordProgress(episode("new", { slug: "other" }), 120, 1800);

    expect(getEpisodeProgress("sjon", "show", "0")).toBeDefined(); // oldest, but on the row
    expect(getEpisodeProgress("sjon", "show", "1")).toBeUndefined(); // oldest evictable
    expect(getEpisodeProgress("sjon", "other", "new")).toBeDefined();
  });
});

describe("persistence", () => {
  it("throttles writes during playback and flushes on demand", async () => {
    jest.useFakeTimers();
    recordProgress(episode("1"), 120, 1800);
    recordProgress(episode("1"), 130, 1800);
    expect(mockSave).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10_000);
    await flushWatchProgress();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(stored().episodes["sjon:show:1"].position).toBe(130);
  });

  it("writes nothing when nothing changed", async () => {
    await flushWatchProgress();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("survives a restart", async () => {
    recordProgress(episode("1"), 120, 1800);
    await flushWatchProgress();
    _resetForTesting();
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(120);
    expect(getContinueWatchingEntry("sjon", "show")?.programTitle).toBe("Show");
  });

  it("retries a failed write with the next flush", async () => {
    mockSave.mockRejectedValueOnce(new Error("disk full"));
    recordProgress(episode("1"), 120, 1800);
    await expect(flushWatchProgress()).resolves.toBeUndefined();
    expect(mockStored).toBeNull();
    await flushWatchProgress();
    expect(stored().episodes["sjon:show:1"].position).toBe(120);
  });

  it("flushes when the app leaves the foreground", async () => {
    let onChange: (state: string) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
      onChange = callback as typeof onChange;
      return { remove: jest.fn() };
    });
    startWatchProgressSync();
    recordProgress(episode("1"), 120, 1800);
    onChange("background");
    await flushWatchProgress();
    expect(stored().episodes["sjon:show:1"].position).toBe(120);
  });

  it("clears memory and storage", async () => {
    recordProgress(episode("1"), 120, 1800);
    await flushWatchProgress();
    await clearWatchHistory();
    expect(getContinueWatching()).toEqual([]);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeUndefined();
    expect(mockClear).toHaveBeenCalled();
    expect(mockStored).toBeNull();
  });
});

describe("loading stored history", () => {
  it("starts fresh from corrupt JSON", () => {
    mockStored = "not json {{{";
    expect(getContinueWatching()).toEqual([]);
    recordProgress(episode("1"), 120, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeDefined();
  });

  it("discards history from another schema version", () => {
    mockStored = JSON.stringify({ v: 99, episodes: { "sjon:show:1": { position: 1, duration: 2, completed: false, updatedAt: 3 } }, programs: {} });
    expect(getEpisodeProgress("sjon", "show", "1")).toBeUndefined();
  });

  it("drops malformed entries individually", () => {
    const now = Date.now();
    mockStored = JSON.stringify({
      v: 1,
      episodes: { "sjon:show:1": { position: 60, duration: 1800, completed: false, updatedAt: now }, "sjon:show:2": { position: "x" } },
      programs: { a: { ...episode("1"), updatedAt: now }, b: { slug: "broken" } },
    });
    expect(getEpisodeProgress("sjon", "show", "1")).toBeDefined();
    expect(getEpisodeProgress("sjon", "show", "2")).toBeUndefined();
    expect(getContinueWatching()).toHaveLength(1);
  });

  it("merges asynchronously loaded history under progress recorded meanwhile", async () => {
    let resolve!: (raw: string) => void;
    mockLoad.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const listener = jest.fn();
    subscribeWatchProgress(listener);

    recordProgress(episode("1"), 300, 1800);
    const flushed = flushWatchProgress();
    expect(mockSave).not.toHaveBeenCalled(); // never overwrite unread history

    const now = Date.now();
    resolve(
      JSON.stringify({
        v: 1,
        episodes: { "sjon:show:1": { position: 60, duration: 1800, completed: false, updatedAt: now - DAY }, "sjon:show:9": { position: 90, duration: 1800, completed: false, updatedAt: now - DAY } },
        programs: {},
      }),
    );
    await flushed;

    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(300);
    expect(getEpisodeProgress("sjon", "show", "9")?.position).toBe(90);
    expect(listener).toHaveBeenCalled();
    expect(Object.keys(stored().episodes).sort()).toEqual(["sjon:show:1", "sjon:show:9"]);
  });

  it("starts empty when reading storage throws", () => {
    mockLoad.mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(getContinueWatching()).toEqual([]);
    recordProgress(episode("1"), 120, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeDefined();
  });
});
