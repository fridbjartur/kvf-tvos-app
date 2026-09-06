import React, { forwardRef, useImperativeHandle } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PlayQueueProvider, usePlayQueue } from "../PlayQueueContext";
import type { QueueEpisode } from "@/types/kvf";

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
