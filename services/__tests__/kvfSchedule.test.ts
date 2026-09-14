/**
 * scheduleResource — URL and cache-key construction, the list-key normalisation
 * that keeps `nowPlaying` identical to its own row, and the failure/identity
 * behaviour the rest of the client relies on.
 */

const mockFiles = new Map<string, string>();

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) || uri.endsWith("/") })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const v = mockFiles.get(uri);
    if (v === undefined) throw new Error("ENOENT");
    return v;
  }),
  writeAsStringAsync: jest.fn(async (uri: string, body: string) => {
    mockFiles.set(uri, body);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from)!);
    mockFiles.delete(from);
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const k of [...mockFiles.keys()]) if (k.startsWith(uri)) mockFiles.delete(k);
  }),
}));

import { scheduleResource } from "../kvfApi";
import { ensure, TTL, __resetForTests } from "../kvfCache";
import type { Channel, MusicTrack, SchedulePage, ScheduleEntry } from "@/types/kvf";

type RawEntry = Partial<ScheduleEntry> & { startTime: string; startsAt: string; title: string };

function entry(raw: RawEntry): ScheduleEntry {
  return {
    endTime: null,
    endsAt: null,
    subtitle: null,
    description: null,
    producer: null,
    thumbnailUrl: null,
    isLive: false,
    faroeIslandsOnly: false,
    program: null,
    music: [] as MusicTrack[],
    listKey: "",
    ...raw,
  } as ScheduleEntry;
}

function schedulePage(channel: Channel, entries: ScheduleEntry[], nowPlaying: ScheduleEntry | null = null): SchedulePage {
  return {
    fetchedAt: "2026-09-14T10:00:00.000Z",
    sourceUrl: `https://kvf.fo/nskra/${channel === "sjon" ? "sv" : "uv"}`,
    channel,
    date: "2026-09-14",
    weekday: "mánadagur",
    dateLabel: "14. september 2026",
    previousDate: "2026-09-13",
    nextDate: "2026-09-15",
    nowPlaying,
    entries,
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: (h: string) => headers[h.toLowerCase()] ?? null },
  };
}

const fetchMock = jest.fn();

beforeEach(() => {
  mockFiles.clear();
  __resetForTests();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("request and cache key", () => {
  it("omits the date so the server resolves today in its own timezone", async () => {
    const resource = scheduleResource("sjon", null);
    expect(resource.key).toBe("kvf:sjon:schedule:today");

    fetchMock.mockResolvedValue(jsonResponse(schedulePage("sjon", [])));
    await ensure(resource);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/sjon\/schedule$/);
  });

  it("sends an explicit date and keys it separately", async () => {
    const resource = scheduleResource("ljod", "2026-09-14");
    expect(resource.key).toBe("kvf:ljod:schedule:2026-09-14");

    fetchMock.mockResolvedValue(jsonResponse(schedulePage("ljod", [])));
    await ensure(resource);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/ljod\/schedule\?date=2026-09-14$/);
  });

  it("expires as fast as the server's own schedule cache", () => {
    expect(scheduleResource("sjon", null).ttlMs).toBe(TTL.SCHEDULE);
    expect(TTL.SCHEDULE).toBeLessThan(TTL.FRONT_PAGE);
  });
});

describe("list keys", () => {
  it("gives repeated start times distinct keys", async () => {
    const entries = [entry({ startTime: "20:00", startsAt: "2026-09-14T18:00:00.000Z", title: "First" }), entry({ startTime: "20:00", startsAt: "2026-09-14T18:00:00.000Z", title: "Second" })];
    fetchMock.mockResolvedValue(jsonResponse(schedulePage("sjon", entries)));

    const cached = await ensure(scheduleResource("sjon", null));
    const keys = cached.data.entries.map((e) => e.listKey);

    expect(new Set(keys).size).toBe(2);
  });

  it("keys the music log of each entry", async () => {
    const music = [
      { title: "Land", artist: "Joakim Berg", listKey: "" },
      { title: "Land", artist: "Someone Else", listKey: "" },
    ] as MusicTrack[];
    fetchMock.mockResolvedValue(jsonResponse(schedulePage("ljod", [entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi", music })])));

    const cached = await ensure(scheduleResource("ljod", null));
    const keys = cached.data.entries[0].music.map((m) => m.listKey);

    expect(new Set(keys).size).toBe(2);
  });

  it("makes nowPlaying the same object as its row", async () => {
    const live = entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi", isLive: true });
    const later = entry({ startTime: "16:05", startsAt: "2026-09-14T14:05:00.000Z", title: "Dagur og Vika" });
    fetchMock.mockResolvedValue(jsonResponse(schedulePage("sjon", [live, later], live)));

    const cached = await ensure(scheduleResource("sjon", null));

    // Identity, not equality — "is this row on air?" is a === check in the UI.
    expect(cached.data.nowPlaying).toBe(cached.data.entries[0]);
  });

  it("leaves nowPlaying null when nothing is on air", async () => {
    fetchMock.mockResolvedValue(jsonResponse(schedulePage("sjon", [entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi" })], null)));

    const cached = await ensure(scheduleResource("sjon", null));

    expect(cached.data.nowPlaying).toBeNull();
  });
});

describe("failure and identity", () => {
  it("does not retry a rejected date", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Invalid request" }, {}, 400));

    await expect(ensure(scheduleResource("sjon", "2026-13-99"))).rejects.toThrow("HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the cached object when the body has not changed", async () => {
    fetchMock.mockResolvedValue(jsonResponse(schedulePage("sjon", [entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi" })])));

    const first = await ensure(scheduleResource("sjon", null));
    const second = await ensure(scheduleResource("sjon", null), true);

    // Same identity ⇒ the entry list does not re-render and focus is left alone.
    expect(second.data).toBe(first.data);
  });

  it("replaces the cached object once the listing really moves", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(schedulePage("sjon", [entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi", isLive: true })])));
    const first = await ensure(scheduleResource("sjon", null));

    fetchMock.mockResolvedValueOnce(jsonResponse(schedulePage("sjon", [entry({ startTime: "16:00", startsAt: "2026-09-14T14:00:00.000Z", title: "Tíðindi", isLive: false })])));
    const second = await ensure(scheduleResource("sjon", null), true);

    expect(second.data).not.toBe(first.data);
    expect(second.data.entries[0].isLive).toBe(false);
  });
});
