import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useKvfResource, type KvfResourceState } from "../useKvfResource";
import { subscribe, swr, type Resource, type SwrCallbacks } from "@/services/kvfCache";

jest.mock("@/services/kvfCache", () => ({ swr: jest.fn(), subscribe: jest.fn(() => jest.fn()) }));

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
