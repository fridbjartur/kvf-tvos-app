import React, { forwardRef, useImperativeHandle } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PlayQueueProvider, usePlayQueue } from "../PlayQueueContext";
import { playQueueManager } from "@/services/playQueueManager";
import { JellyfinVideoItem } from "@/types/jellyfin";

jest.mock("@/services/jellyfinApi");
jest.mock("@/utils/logger");

const mockVideos: JellyfinVideoItem[] = [
  {
    Id: "video1",
    Name: "Episode 1",
    Type: "Video",
    RunTimeTicks: 36000000000,
    Path: "/media/ep1.mp4",
  },
  {
    Id: "video2",
    Name: "Episode 2",
    Type: "Video",
    RunTimeTicks: 42000000000,
    Path: "/media/ep2.mp4",
  },
  {
    Id: "video3",
    Name: "Episode 3",
    Type: "Video",
    RunTimeTicks: 39000000000,
    Path: "/media/ep3.mp4",
  },
];

type QueueHandle = {
  getQueue: () => JellyfinVideoItem[];
  getCurrentIndex: () => number;
  getIsLoading: () => boolean;
  getHasNext: () => boolean;
  getNextVideo: () => JellyfinVideoItem | null;
  getProgress: () => string;
  buildQueue: (folderId: string, folderName: string, startVideoId: string, folderType?: "folder" | "playlist") => Promise<void>;
  advanceToNext: () => JellyfinVideoItem | null;
  clear: () => void;
};

const QueueHarness = forwardRef<QueueHandle>((_, ref) => {
  const queue = usePlayQueue();

  useImperativeHandle(
    ref,
    () => ({
      getQueue: () => queue.queue,
      getCurrentIndex: () => queue.currentIndex,
      getIsLoading: () => queue.isLoading,
      getHasNext: () => queue.hasNext,
      getNextVideo: () => queue.nextVideo,
      getProgress: () => queue.progress,
      buildQueue: queue.buildQueue,
      advanceToNext: queue.advanceToNext,
      clear: queue.clear,
    }),
    [queue],
  );

  return null;
});
QueueHarness.displayName = "QueueHarness";

describe("PlayQueueContext", () => {
  let testRenderer: TestRenderer.ReactTestRenderer;
  const harnessRef = React.createRef<QueueHandle>();

  beforeEach(() => {
    playQueueManager.clear();

    // Pre-populate the singleton so the context reads initial state synchronously
    // (no async needed for initial render)
    act(() => {
      testRenderer = TestRenderer.create(
        <PlayQueueProvider>
          <QueueHarness ref={harnessRef} />
        </PlayQueueProvider>,
      );
    });
  });

  afterEach(() => {
    testRenderer.unmount();
    playQueueManager.clear();
  });

  it("provides initial empty state", () => {
    expect(harnessRef.current?.getQueue()).toEqual([]);
    expect(harnessRef.current?.getCurrentIndex()).toBe(-1);
    expect(harnessRef.current?.getIsLoading()).toBe(false);
    expect(harnessRef.current?.getHasNext()).toBe(false);
    expect(harnessRef.current?.getNextVideo()).toBeNull();
    expect(harnessRef.current?.getProgress()).toBe("");
  });

  it("exposes advanceToNext and clear functions", () => {
    expect(typeof harnessRef.current?.advanceToNext).toBe("function");
    expect(typeof harnessRef.current?.clear).toBe("function");
    expect(typeof harnessRef.current?.buildQueue).toBe("function");
  });

  it("computes hasNext correctly", async () => {
    // Manually set up the singleton with mock data
    const { fetchRecursiveVideos } = require("@/services/jellyfinApi");
    fetchRecursiveVideos.mockResolvedValue(mockVideos);

    await act(async () => {
      await harnessRef.current?.buildQueue("folder1", "Movies", "video1");
    });

    expect(harnessRef.current?.getHasNext()).toBe(true);
    expect(harnessRef.current?.getNextVideo()?.Name).toBe("Episode 2");
    expect(harnessRef.current?.getProgress()).toBe("1 of 3");
  });

  it("updates state when advanceToNext is called", async () => {
    const { fetchRecursiveVideos } = require("@/services/jellyfinApi");
    fetchRecursiveVideos.mockResolvedValue(mockVideos);

    await act(async () => {
      await harnessRef.current?.buildQueue("folder1", "Movies", "video1");
    });

    act(() => {
      harnessRef.current?.advanceToNext();
    });

    expect(harnessRef.current?.getCurrentIndex()).toBe(1);
    expect(harnessRef.current?.getProgress()).toBe("2 of 3");
  });

  it("resets state when clear is called", async () => {
    const { fetchRecursiveVideos } = require("@/services/jellyfinApi");
    fetchRecursiveVideos.mockResolvedValue(mockVideos);

    await act(async () => {
      await harnessRef.current?.buildQueue("folder1", "Movies", "video1");
    });

    act(() => {
      harnessRef.current?.clear();
    });

    expect(harnessRef.current?.getQueue()).toEqual([]);
    expect(harnessRef.current?.getCurrentIndex()).toBe(-1);
    expect(harnessRef.current?.getHasNext()).toBe(false);
  });
});
