jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  Settings: {
    get: jest.fn(() => {
      throw new Error("Apple storage must not be used");
    }),
  },
}));

const mockFiles = new Map<string, string>();
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  cacheDirectory: "file:///cache/",
  getInfoAsync: jest.fn(async (path: string) => ({ exists: mockFiles.has(path) })),
  readAsStringAsync: jest.fn(async (path: string) => mockFiles.get(path)),
  writeAsStringAsync: jest.fn(async (path: string, raw: string) => {
    mockFiles.set(path, raw);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from)!);
    mockFiles.delete(from);
  }),
  deleteAsync: jest.fn(async (path: string) => {
    mockFiles.delete(path);
  }),
}));

import * as FileSystem from "expo-file-system/legacy";
import { watchProgressStorage } from "../watchProgressStorage";

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
});

it("loads history from persistent documents after repeated saves and cache eviction", async () => {
  expect(await watchProgressStorage.load()).toBeNull();
  await watchProgressStorage.save('{"position":10}');
  await watchProgressStorage.save('{"position":20}');
  mockFiles.delete("file:///cache/");
  expect(await watchProgressStorage.load()).toBe('{"position":20}');
  expect([...mockFiles.keys()]).toEqual(["file:///documents/watch_progress.json"]);
});

it("preserves the previous history if writing the replacement fails", async () => {
  await watchProgressStorage.save("previous");
  jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error("disk full"));
  await expect(watchProgressStorage.save("replacement")).rejects.toThrow("disk full");
  expect(await watchProgressStorage.load()).toBe("previous");
});

it("clears saved history idempotently", async () => {
  await watchProgressStorage.save("history");
  await watchProgressStorage.clear();
  await watchProgressStorage.clear();
  expect(await watchProgressStorage.load()).toBeNull();
});
