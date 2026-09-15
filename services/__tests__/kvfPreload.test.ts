import { AppState } from "react-native";
import { ensure, hydrate, prefetch } from "../kvfCache";
import { allProgramsResource, frontPageResource } from "../kvfApi";
import { refreshAll, setActiveSchedule, startKvfSync, stopKvfSync, warmOnLaunch } from "../kvfPreload";
import { logger } from "@/utils/logger";
import type { Resource } from "../kvfCache";
import type { SchedulePage } from "@/types/kvf";

jest.mock("../kvfCache", () => ({ cacheGet: jest.fn(async () => null), ensure: jest.fn(), prefetch: jest.fn(), hydrate: jest.fn(), flushIndex: jest.fn() }));
jest.mock("../kvfApi", () => ({
  frontPageResource: (section: string) => ({ key: section }),
  allProgramsResource: () => ({ key: "all" }),
}));
jest.mock("expo-image", () => ({ Image: { prefetch: jest.fn() } }));
jest.mock("@/utils/logger", () => ({ logger: { debug: jest.fn(), warn: jest.fn() } }));

const originalState = AppState.currentState;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = "active";
  jest.mocked(ensure).mockResolvedValue({ data: { featuredPrograms: [], categories: [] } } as never);
  jest.mocked(hydrate).mockResolvedValue(undefined);
});
afterEach(() => {
  stopKvfSync();
  setActiveSchedule(null);
  AppState.currentState = originalState;
  jest.clearAllTimers();
  jest.useRealTimers();
});
it("still rebuilds search when one cold section fails to refresh", async () => {
  jest.mocked(ensure).mockImplementation(async (resource) => {
    if (resource.key === frontPageResource("ljod").key) throw new Error("Offline");
    return { data: { featuredPrograms: [], categories: [] } } as never;
  });
  await refreshAll();
  expect(ensure).toHaveBeenCalledWith(allProgramsResource(), true);
});
it("handles launch warm-up failure without an unhandled rejection", async () => {
  jest.mocked(hydrate).mockRejectedValueOnce(new Error("Cache unavailable"));
  startKvfSync();
  await jest.advanceTimersByTimeAsync(0);
  expect(logger.warn).toHaveBeenCalledWith("kvfPreload: launch warm-up failed", expect.anything());
});
it("does not poll while backgrounded and stops polling after cleanup", async () => {
  const schedule = { key: "schedule" } as Resource<SchedulePage>;
  setActiveSchedule(schedule);
  const stop = startKvfSync();
  await jest.advanceTimersByTimeAsync(0);
  jest.mocked(ensure).mockClear();
  AppState.currentState = "background";
  await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
  expect(ensure).not.toHaveBeenCalled();
  AppState.currentState = "active";
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(ensure).toHaveBeenCalledWith(schedule, true);
  stop();
  jest.mocked(ensure).mockClear();
  await jest.advanceTimersByTimeAsync(15 * 60 * 1000);
  expect(ensure).not.toHaveBeenCalled();
});

it("warms the catalog once and does not retry missing pages just to prefetch artwork", async () => {
  await warmOnLaunch();
  await jest.advanceTimersByTimeAsync(0);
  expect(prefetch).toHaveBeenCalledTimes(1);
  expect(prefetch).toHaveBeenCalledWith(allProgramsResource());
  expect(ensure).not.toHaveBeenCalled();
});
