import React, { forwardRef, useImperativeHandle } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { buildPlayQueue, PlayQueueProvider, usePlayQueue } from "../PlayQueueContext";
import type { Episode, QueueEpisode } from "@/types/kvf";

const mockEpisodes: QueueEpisode[] = [
  { sid: "ep1", slug: "show", title: "Episode 1", section: "sjon", thumbnailUrl: null },
  { sid: "ep2", slug: "show", title: "Episode 2", section: "sjon", thumbnailUrl: null },
  { sid: "ep3", slug: "show", title: "Episode 3", section: "sjon", thumbnailUrl: null },
];

type QueueHandle = ReturnType<typeof usePlayQueue>;

const QueueHarness = forwardRef<QueueHandle>((_, ref) => {
  const queue = usePlayQueue();
  useImperativeHandle(ref, () => queue, [queue]);
  return null;
});
QueueHarness.displayName = "QueueHarness";

function renderQueue() {
  const harnessRef = React.createRef<QueueHandle>();
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <PlayQueueProvider>
        <QueueHarness ref={harnessRef} />
      </PlayQueueProvider>,
    );
  });
  return { harnessRef, unmount: () => act(() => renderer.unmount()) };
}

describe("PlayQueueContext", () => {
  it("starts with an empty queue", () => {
    const { harnessRef, unmount } = renderQueue();

    expect(harnessRef.current?.episodes).toEqual([]);
    expect(harnessRef.current?.currentIndex).toBe(-1);
    expect(harnessRef.current?.hasNext).toBe(false);
    expect(harnessRef.current?.nextEpisode).toBeNull();
    expect(harnessRef.current?.progress).toBe("");

    unmount();
  });

  it("populates state when setQueue is called", () => {
    const { harnessRef, unmount } = renderQueue();

    act(() => {
      harnessRef.current?.setQueue(mockEpisodes, 0);
    });

    expect(harnessRef.current?.episodes).toHaveLength(3);
    expect(harnessRef.current?.currentIndex).toBe(0);
    expect(harnessRef.current?.hasNext).toBe(true);
    expect(harnessRef.current?.nextEpisode?.sid).toBe("ep2");
    expect(harnessRef.current?.progress).toBe("1 of 3");

    unmount();
  });

  it("starts mid-queue when given a start index", () => {
    const { harnessRef, unmount } = renderQueue();

    act(() => {
      harnessRef.current?.setQueue(mockEpisodes, 2);
    });

    expect(harnessRef.current?.currentIndex).toBe(2);
    expect(harnessRef.current?.hasNext).toBe(false);
    expect(harnessRef.current?.nextEpisode).toBeNull();
    expect(harnessRef.current?.progress).toBe("3 of 3");

    unmount();
  });

  it("advances to the next episode and returns it", () => {
    const { harnessRef, unmount } = renderQueue();

    act(() => {
      harnessRef.current?.setQueue(mockEpisodes, 0);
    });

    const result: { advanced: QueueEpisode | null } = { advanced: null };
    act(() => {
      result.advanced = harnessRef.current?.advance() ?? null;
    });

    expect(result.advanced?.sid).toBe("ep2");
    expect(harnessRef.current?.currentIndex).toBe(1);
    expect(harnessRef.current?.progress).toBe("2 of 3");
    expect(harnessRef.current?.nextEpisode?.sid).toBe("ep3");

    unmount();
  });

  it("returns null from advance at the end of the queue", () => {
    const { harnessRef, unmount } = renderQueue();

    act(() => {
      harnessRef.current?.setQueue(mockEpisodes, 2);
    });

    const result: { advanced: QueueEpisode | null } = { advanced: null };
    act(() => {
      result.advanced = harnessRef.current?.advance() ?? null;
    });

    expect(result.advanced).toBeNull();
    expect(harnessRef.current?.currentIndex).toBe(2);

    unmount();
  });

  it("resets state when clear is called", () => {
    const { harnessRef, unmount } = renderQueue();

    act(() => {
      harnessRef.current?.setQueue(mockEpisodes, 1);
    });
    act(() => {
      harnessRef.current?.clear();
    });

    expect(harnessRef.current?.episodes).toEqual([]);
    expect(harnessRef.current?.currentIndex).toBe(-1);
    expect(harnessRef.current?.hasNext).toBe(false);
    expect(harnessRef.current?.progress).toBe("");

    unmount();
  });

  it("throws when usePlayQueue is used outside the provider", () => {
    function Bare() {
      usePlayQueue();
      return null;
    }
    expect(() => {
      act(() => {
        TestRenderer.create(<Bare />);
      });
    }).toThrow("usePlayQueue must be used within PlayQueueProvider");
  });
});

describe("buildPlayQueue", () => {
  // As the API returns them and as the row renders them: newest first.
  const row: Episode[] = [
    { sid: "new", slug: "show", title: "Newest", publishDate: "2026-03-01", thumbnailUrl: null, episodeUrl: "/3", listKey: "new" },
    { sid: "mid", slug: "show", title: "Middle", publishDate: "2026-02-01", thumbnailUrl: null, episodeUrl: "/2", listKey: "mid" },
    { sid: "old", slug: "show", title: "Oldest", publishDate: "2026-01-01", thumbnailUrl: null, episodeUrl: "/1", listKey: "old" },
  ];

  it("queues in broadcast order, so advancing reaches newer episodes", () => {
    const { queue } = buildPlayQueue(row, "sjon", "old");
    expect(queue.map((e) => e.sid)).toEqual(["old", "mid", "new"]);
  });

  it("leaves nothing up next when starting on the newest episode", () => {
    const { queue, startIndex } = buildPlayQueue(row, "sjon", "new");
    expect(startIndex).toBe(queue.length - 1);

    const { harnessRef, unmount } = renderQueue();
    act(() => harnessRef.current!.setQueue(queue, startIndex));
    expect(harnessRef.current!.hasNext).toBe(false);
    expect(harnessRef.current!.nextEpisode).toBeNull();
    unmount();
  });

  it("advances from the oldest episode to the next newer one", () => {
    const { queue, startIndex } = buildPlayQueue(row, "sjon", "old");

    const { harnessRef, unmount } = renderQueue();
    act(() => harnessRef.current!.setQueue(queue, startIndex));
    expect(harnessRef.current!.nextEpisode?.sid).toBe("mid");

    let advanced: QueueEpisode | null = null;
    act(() => {
      advanced = harnessRef.current!.advance();
    });
    expect(advanced!.sid).toBe("mid");
    expect(harnessRef.current!.nextEpisode?.sid).toBe("new");
    unmount();
  });

  it("does not mutate the caller's episode row", () => {
    const original = [...row];
    buildPlayQueue(row, "sjon", "mid");
    expect(row).toEqual(original);
  });

  it("starts at the beginning when the episode is not in the row", () => {
    expect(buildPlayQueue(row, "sjon", "missing").startIndex).toBe(0);
  });
});
