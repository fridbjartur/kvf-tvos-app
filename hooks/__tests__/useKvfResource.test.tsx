import { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useKvfResource, type KvfResourceState } from "../useKvfResource";
import { cachePeek, isRevalidating, subscribe, subscribeStatus, swr, type Resource, type SwrCallbacks } from "@/services/kvfCache";

jest.mock("@/services/kvfCache", () => ({
  swr: jest.fn(),
  subscribe: jest.fn(() => jest.fn()),
  subscribeStatus: jest.fn(() => jest.fn()),
  // Nothing warm by default, so the existing cases still exercise a cold start.
  cachePeek: jest.fn(() => null),
  isRevalidating: jest.fn(() => false),
}));

const resource = (key: string): Resource<string> => ({ key, ttlMs: 1000, fetcher: jest.fn() });
const a = resource("ljod");
const b = resource("ljod-vit");
let state: KvfResourceState<string>;
let renderer: TestRenderer.ReactTestRenderer;
let requests: SwrCallbacks<string>[];

function Harness({ value }: { value: Resource<string> | null }) {
  const current = useKvfResource(value);
  useEffect(() => {
    state = current;
  }, [current]);
  return null;
}

const render = (value: Resource<string> | null) => {
  act(() => {
    if (renderer) renderer.update(<Harness value={value} />);
    else renderer = TestRenderer.create(<Harness value={value} />);
  });
};
const resolve = (index: number, value: string) => {
  act(() => {
    requests[index].onData?.(value, { fromCache: false });
    requests[index].onLoading?.(false);
  });
};

beforeEach(() => {
  requests = [];
  jest.clearAllMocks();
  jest.mocked(cachePeek).mockReturnValue(null);
  jest.mocked(isRevalidating).mockReturnValue(false);
  jest.mocked(swr).mockImplementation(async (_resource, callbacks) => {
    requests.push(callbacks as SwrCallbacks<string>);
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  renderer = undefined!;
});

it("shows loading immediately, including before the cache has answered", () => {
  render(a);
  expect(state.isLoading).toBe(true);
  resolve(0, "radio");
  expect(state.data).toBe("radio");
  expect(state.isLoading).toBe(false);
});

it("ignores every callback from the previous category after switching", () => {
  render(a);
  render(b);
  resolve(1, "children");
  resolve(0, "old radio");
  act(() => {
    requests[0].onLoading?.(true);
    requests[0].onRefreshing?.(true);
    requests[0].onError?.(new Error("old failure"));
  });
  expect(state).toMatchObject({ data: "children", isLoading: false, isRefreshing: false, error: null });
});

it("does not let the first visit overwrite a later visit to the same key", () => {
  render(a);
  render(b);
  render(a);
  resolve(2, "current radio");
  resolve(0, "first visit");
  expect(state.data).toBe("current radio");
});

it("clears category errors on navigation and allows retry", () => {
  render(a);
  act(() => {
    requests[0].onError?.(new Error("offline"));
    requests[0].onLoading?.(false);
  });
  expect(state.error).toBe("offline");
  render(b);
  expect(state).toMatchObject({ data: null, error: null, isLoading: true });
  act(() => state.refresh());
  expect(swr).toHaveBeenLastCalledWith(b, expect.any(Object), true);
  resolve(2, "retried");
  resolve(1, "superseded");
  expect(state.data).toBe("retried");
});

it("ignores callbacks after the resource is disabled and unsubscribes", () => {
  render(a);
  const unsubscribe = jest.mocked(subscribe).mock.results[0].value;
  render(null);
  resolve(0, "late");
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(state).toMatchObject({ data: null, error: null, isLoading: false, isRefreshing: false });
});

it("does not restart requests when the caller rebuilds the same resource", () => {
  render(a);
  render(resource(a.key));
  expect(swr).toHaveBeenCalledTimes(1);
});

it("paints from the memory tier without a loading frame", () => {
  (cachePeek as jest.Mock).mockReturnValue("warm");
  render(a);
  // No callback has been resolved yet — this is the very first render.
  expect(state).toMatchObject({ data: "warm", isLoading: false });
});

it("reports a revalidation it did not start, so preload refreshes are visible", () => {
  (cachePeek as jest.Mock).mockReturnValue("cached");
  render(a);
  expect(state.isRefreshing).toBe(false);

  const notify = (subscribeStatus as jest.Mock).mock.calls[0][1] as (v: boolean) => void;
  act(() => notify(true));
  expect(state).toMatchObject({ data: "cached", isRefreshing: true, isLoading: false });

  act(() => notify(false));
  expect(state.isRefreshing).toBe(false);
});

it("never reports refreshing while there is nothing on screen to refresh", () => {
  render(a);
  const notify = (subscribeStatus as jest.Mock).mock.calls[0][1] as (v: boolean) => void;
  act(() => notify(true));
  expect(state).toMatchObject({ data: null, isLoading: true, isRefreshing: false });
});

it("unsubscribes from status updates when the resource is disabled", () => {
  render(a);
  const unsubscribe = (subscribeStatus as jest.Mock).mock.results[0].value;
  render(null);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it("carries the in-flight status across a key change before the effect runs", () => {
  (cachePeek as jest.Mock).mockReturnValue("warm-b");
  (isRevalidating as jest.Mock).mockReturnValue(true);
  render(a);
  render(b);
  expect(state).toMatchObject({ data: "warm-b", isLoading: false, isRefreshing: true });
});
