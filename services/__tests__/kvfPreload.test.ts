import { AppState, type AppStateStatus } from "react-native";
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
let onAppStateChange: (next: AppStateStatus) => void;
function changeAppState(next: AppStateStatus): void {
  AppState.currentState = next;
  onAppStateChange(next);
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = "active";
  jest.mocked(ensure).mockResolvedValue({ data: { featuredPrograms: [], categories: [] } } as never);
  jest.mocked(hydrate).mockResolvedValue(undefined);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    onAppStateChange = handler;
    return { remove: jest.fn() };
  });
});
afterEach(() => {
  stopKvfSync();
  setActiveSchedule(null);
  AppState.currentState = originalState;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
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

it("refreshes a still-mounted schedule immediately after hours on another tab", async () => {
  const schedule = { key: "kvf:sjon:schedule:today" } as Resource<SchedulePage>;
  startKvfSync();
  setActiveSchedule(schedule);
  await jest.advanceTimersByTimeAsync(0);
  jest.mocked(ensure).mockClear();

  // Blurring a native tab unregisters its schedule without unmounting it.
  setActiveSchedule(null);
  await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
  expect(ensure).not.toHaveBeenCalledWith(schedule, true);
  jest.mocked(ensure).mockClear();

  // No timer tick, remount or channel change should be needed on return.
  setActiveSchedule(schedule);
  expect(ensure).toHaveBeenCalledTimes(1);
  expect(ensure).toHaveBeenCalledWith(schedule, true);
});

it("revalidates on a quick return even if the schedule cache is still fresh", () => {
  const schedule = { key: "kvf:sjon:schedule:today" } as Resource<SchedulePage>;
  setActiveSchedule(schedule);
  jest.mocked(ensure).mockClear();
  setActiveSchedule(null);
  setActiveSchedule(schedule);
  expect(ensure).toHaveBeenCalledWith(schedule, true);
});

it("refreshes and polls only the selected channel and date", async () => {
  const television = { key: "kvf:sjon:schedule:today" } as Resource<SchedulePage>;
  const radio = { key: "kvf:ljod:schedule:today" } as Resource<SchedulePage>;
  const anotherDay = { key: "kvf:ljod:schedule:2026-09-30" } as Resource<SchedulePage>;
  startKvfSync();
  await jest.advanceTimersByTimeAsync(0);
  for (const schedule of [television, radio, anotherDay]) {
    setActiveSchedule(null);
    jest.mocked(ensure).mockClear();
    setActiveSchedule(schedule);
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith(schedule, true);
  }
  jest.mocked(ensure).mockClear();
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(ensure).toHaveBeenCalledTimes(1);
  expect(ensure).toHaveBeenCalledWith(anotherDay, true);
});

it.each([true, false])("refreshes on app resume when schedule focus arrives before resume: %s", async (focusBeforeResume) => {
  const schedule = { key: "kvf:sjon:schedule:today" } as Resource<SchedulePage>;
  startKvfSync();
  await jest.advanceTimersByTimeAsync(0);
  changeAppState("background");
  jest.mocked(ensure).mockClear();

  if (focusBeforeResume) setActiveSchedule(schedule);
  expect(ensure).not.toHaveBeenCalled();
  changeAppState("active");
  if (!focusBeforeResume) setActiveSchedule(schedule);

  expect(ensure).toHaveBeenCalledTimes(1);
  expect(ensure).toHaveBeenCalledWith(schedule, true);
});

it("keeps polling after an immediate refresh fails", async () => {
  const schedule = { key: "kvf:sjon:schedule:today" } as Resource<SchedulePage>;
  startKvfSync();
  await jest.advanceTimersByTimeAsync(0);
  jest.mocked(ensure).mockRejectedValueOnce(new Error("Offline"));
  setActiveSchedule(schedule);
  await jest.advanceTimersByTimeAsync(0);
  expect(logger.debug).toHaveBeenCalledWith("kvfPreload: schedule refresh failed, keeping cached data", expect.anything());

  jest.mocked(ensure).mockClear();
  await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(ensure).toHaveBeenCalledWith(schedule, true);
});
