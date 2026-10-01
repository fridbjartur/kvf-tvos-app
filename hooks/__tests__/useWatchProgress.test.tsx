import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { OnLoadData, OnPlaybackStateChangedData, OnProgressData, VideoRef } from "react-native-video";
import { useWatchProgress, type WatchProgressCallbacks } from "../useWatchProgress";
import { _resetForTesting, flushWatchProgress, getContinueWatchingEntry, getEpisodeProgress, markCompleted, recordProgress, type WatchTarget } from "@/services/watchProgressService";

let mockStored: string | null = null;
const mockSave = jest.fn(async (raw: string) => {
  mockStored = raw;
});
jest.mock("@/services/watchProgressStorage", () => ({
  watchProgressStorage: { load: () => mockStored, save: (raw: string) => mockSave(raw), clear: async () => {} },
}));

const target: WatchTarget = { section: "sjon", slug: "show", sid: "1", programTitle: "Show", episodeTitle: "Episode 1", thumbnailUrl: null };
const next: WatchTarget = { ...target, sid: "2", episodeTitle: "Episode 2" };

let renderer: TestRenderer.ReactTestRenderer | undefined;
let callbacks: WatchProgressCallbacks;
let holdPlayback: boolean;
const seek = jest.fn();
const videoRef = { current: { seek } as unknown as VideoRef };

function Harness(props: { target: WatchTarget | null; next?: WatchTarget | null; fromStart?: boolean }) {
  const result = useWatchProgress({ target: props.target, next: props.next ?? null, fromStart: props.fromStart, videoRef });
  callbacks = result.callbacks;
  holdPlayback = result.holdPlayback;
  return null;
}

function mount(element: React.ReactElement) {
  act(() => {
    renderer = TestRenderer.create(element);
  });
}

const load = (duration: number) => act(() => callbacks.onLoad({ duration, currentTime: 0 } as OnLoadData));
const progress = (currentTime: number, seekableDuration?: number) => act(() => callbacks.onProgress({ currentTime, seekableDuration } as OnProgressData));
const seeked = () => act(() => callbacks.onSeek());
const playbackState = (isPlaying: boolean, isSeeking = false) => act(() => callbacks.onPlaybackStateChanged({ isPlaying, isSeeking } as OnPlaybackStateChangedData));

beforeEach(() => {
  mockStored = null;
  _resetForTesting();
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  _resetForTesting();
  jest.useRealTimers();
});

describe("resume", () => {
  it("holds playback, seeks to the saved position on load, and releases once the seek lands", () => {
    recordProgress(target, 600, 1800);
    mount(<Harness target={target} />);
    expect(holdPlayback).toBe(true);

    load(1800);
    expect(seek).toHaveBeenCalledWith(597);
    expect(holdPlayback).toBe(true);

    seeked();
    expect(holdPlayback).toBe(false);
  });

  it("releases when progress shows the seek landed, without recording the episode's start", () => {
    recordProgress(target, 600, 1800);
    mount(<Harness target={target} />);
    load(1800);

    progress(0.2);
    expect(holdPlayback).toBe(true);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(600);

    progress(597.4);
    expect(holdPlayback).toBe(false);
  });

  it("never leaves the player stuck when the seek does not report back", () => {
    jest.useFakeTimers();
    recordProgress(target, 600, 1800);
    mount(<Harness target={target} />);
    load(1800);
    act(() => jest.advanceTimersByTime(4000));
    expect(holdPlayback).toBe(false);
  });

  it("does not hold or seek when starting from the beginning", () => {
    recordProgress(target, 600, 1800);
    mount(<Harness target={target} fromStart />);
    expect(holdPlayback).toBe(false);
    load(1800);
    expect(seek).not.toHaveBeenCalled();
    act(() => renderer?.unmount());

    mount(<Harness target={{ ...target, sid: "unwatched" }} />);
    expect(holdPlayback).toBe(false);
    load(1800);
    expect(seek).not.toHaveBeenCalled();
  });

  it("does not hold a finished episode", () => {
    markCompleted(target, 1800);
    mount(<Harness target={target} />);
    expect(holdPlayback).toBe(false);
  });

  it("returns to where playback reached after a reload", () => {
    mount(<Harness target={target} />);
    load(1800);
    progress(400);
    seek.mockClear();
    load(1800);
    expect(seek).toHaveBeenCalledWith(400);
    expect(holdPlayback).toBe(true);
    seeked();
    expect(holdPlayback).toBe(false);
  });
});

describe("recording", () => {
  it("records every few seconds of movement, including seeks, with the full duration", () => {
    mount(<Harness target={target} />);
    load(1800);
    progress(6);
    expect(getEpisodeProgress("sjon", "show", "1")).toBeUndefined(); // below the minimum
    progress(12);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ position: 12, duration: 1800 });
    progress(14);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(12);
    progress(18);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(18);
    progress(900);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(900);
  });

  it("takes the duration from the seekable range when load reported none", () => {
    mount(<Harness target={target} />);
    load(Number.NaN);
    progress(60, 1800);
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ position: 60, duration: 1800 });
  });

  it("writes immediately on pause", async () => {
    mount(<Harness target={target} />);
    load(1800);
    progress(20);
    progress(23);
    playbackState(false);
    // Queued behind the write the pause started, so this resolves after it.
    await flushWatchProgress();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStored!).episodes["sjon:show:1"].position).toBe(23);
  });

  it("ignores the seeking half of a seek", () => {
    mount(<Harness target={target} />);
    load(1800);
    progress(20);
    progress(23);
    playbackState(false, true);
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(20);
  });

  it("records the final position when the player closes", async () => {
    mount(<Harness target={target} />);
    load(1800);
    progress(20);
    progress(42);
    act(() => renderer?.unmount());
    renderer = undefined;
    await flushWatchProgress();
    expect(getEpisodeProgress("sjon", "show", "1")?.position).toBe(42);
    expect(JSON.parse(mockStored!).episodes["sjon:show:1"].position).toBe(42);
  });

  it("does nothing without a target (live streams)", () => {
    mount(<Harness target={null} />);
    expect(holdPlayback).toBe(false);
    load(1800);
    progress(400);
    act(() => callbacks.onEnd());
    expect(seek).not.toHaveBeenCalled();
    expect(getContinueWatchingEntry("sjon", "show")).toBeUndefined();
  });
});

describe("finishing", () => {
  it("marks the episode watched at the end and moves the row on to the next one", () => {
    mount(<Harness target={target} next={next} />);
    load(1800);
    progress(1000);
    act(() => callbacks.onEnd());
    expect(getEpisodeProgress("sjon", "show", "1")).toMatchObject({ completed: true });
    expect(getContinueWatchingEntry("sjon", "show")?.sid).toBe("2");

    // Late progress and the close must not reopen the finished episode.
    progress(1700);
    act(() => renderer?.unmount());
    renderer = undefined;
    expect(getEpisodeProgress("sjon", "show", "1")?.completed).toBe(true);
  });

  it("counts skipping to the next episode as finishing this one", () => {
    mount(<Harness target={target} next={next} />);
    load(300);
    progress(250);
    act(() => callbacks.markWatched());
    expect(getEpisodeProgress("sjon", "show", "1")?.completed).toBe(true);
  });

  it("gives the next episode its own progress once past the minimum", () => {
    mount(<Harness target={target} next={next} />);
    load(1800);
    progress(1000);
    act(() => callbacks.onEnd());
    act(() => renderer?.unmount());

    // The next session, as Up Next starts it.
    mount(<Harness target={next} />);
    expect(holdPlayback).toBe(false);
    load(1500);
    progress(12);
    expect(getEpisodeProgress("sjon", "show", "2")).toMatchObject({ position: 12, duration: 1500, completed: false });
    expect(getContinueWatchingEntry("sjon", "show")?.sid).toBe("2");
  });
});
