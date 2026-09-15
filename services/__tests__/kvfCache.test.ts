/**
 * kvfCache — covers the behaviours the UI depends on:
 * unchanged payloads must not notify, stale data must survive a failed refresh,
 * concurrent callers must share one request, and namespaces must isolate.
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

import { cacheGet, cachePeek, cacheSet, ensure, flushIndex, isRevalidating, isStale, setNamespace, subscribe, subscribeStatus, swr, __resetForTests, type Resource } from "../kvfCache";

function makeResource<T>(key: string, fetcher: Resource<T>["fetcher"], ttlMs = 1000): Resource<T> {
  return { key, ttlMs, fetcher };
}

beforeEach(() => {
  mockFiles.clear();
  __resetForTests();
});

describe("read/write round-trip", () => {
  it("returns what was written, through memory", async () => {
    await cacheSet("k", { n: 1 }, 1000, { hash: "h1" });
    const entry = await cacheGet<{ n: number }>("k");
    expect(entry?.data).toEqual({ n: 1 });
    expect(entry?.hash).toBe("h1");
  });

  it("reads back from disk after memory is lost", async () => {
    await cacheSet("k", { n: 7 }, 1000, { hash: "h1" });
    await flushIndex();
    __resetForTests();

    const entry = await cacheGet<{ n: number }>("k");
    expect(entry?.data).toEqual({ n: 7 });
  });

  it("hides entries written under a different namespace", async () => {
    setNamespace("http://a");
    await cacheSet("k", { n: 1 }, 1000, { hash: "h1" });

    setNamespace("http://b");
    expect(await cacheGet("k")).toBeNull();

    setNamespace("http://a");
    expect((await cacheGet<{ n: number }>("k"))?.data).toEqual({ n: 1 });
  });
});

describe("unchanged payloads", () => {
  it("does not emit onData a second time when the hash is unchanged", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "same" }); // negative ttl ⇒ stale

    const fetcher = jest.fn(async () => ({ status: "unchanged" as const }));
    const onData = jest.fn();

    await swr(makeResource("k", fetcher), { onData });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledTimes(1); // the cached emission only
    expect(onData).toHaveBeenCalledWith({ n: 1 }, { fromCache: true });
  });

  it("treats an identical hash from a 200 response as unchanged", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "same" });

    const onData = jest.fn();
    await swr(
      makeResource("k", async () => ({ status: "ok" as const, data: { n: 999 }, meta: { hash: "same" } })),
      { onData },
    );

    expect(onData).toHaveBeenCalledTimes(1);
    expect((await cacheGet<{ n: number }>("k"))?.data).toEqual({ n: 1 });
  });

  it("refreshes freshness so the next read does not refetch", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "same" });
    const fetcher = jest.fn(async () => ({ status: "unchanged" as const }));

    await swr(makeResource("k", fetcher, 60_000), {});
    await swr(makeResource("k", fetcher, 60_000), {});

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers when nothing changed", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "same" });
    const sub = jest.fn();
    subscribe("k", sub);

    await swr(
      makeResource("k", async () => ({ status: "unchanged" as const })),
      {},
    );
    expect(sub).not.toHaveBeenCalled();
  });
});

describe("changed payloads", () => {
  it("emits twice and notifies subscribers", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "old" });
    const sub = jest.fn();
    subscribe("k", sub);
    const onData = jest.fn();

    await swr(
      makeResource("k", async () => ({ status: "ok" as const, data: { n: 2 }, meta: { hash: "new" } })),
      { onData },
    );

    expect(onData).toHaveBeenNthCalledWith(1, { n: 1 }, { fromCache: true });
    expect(onData).toHaveBeenNthCalledWith(2, { n: 2 }, { fromCache: false });
    expect(sub).toHaveBeenCalledTimes(1);
  });
});

describe("loading states", () => {
  it("signals loading only when nothing is cached", async () => {
    const onLoading = jest.fn();
    const onRefreshing = jest.fn();

    await swr(
      makeResource("cold", async () => ({ status: "ok" as const, data: 1, meta: { hash: "h" } })),
      { onLoading, onRefreshing },
    );
    expect(onLoading).toHaveBeenCalledWith(true);
    expect(onRefreshing).not.toHaveBeenCalledWith(true);

    onLoading.mockClear();
    await cacheSet("warm", 1, -1, { hash: "h" });
    await swr(
      makeResource("warm", async () => ({ status: "unchanged" as const })),
      { onLoading, onRefreshing },
    );

    expect(onLoading).not.toHaveBeenCalledWith(true);
    expect(onRefreshing).toHaveBeenCalledWith(true);
  });

  it("skips the network entirely while fresh", async () => {
    const fetcher = jest.fn();
    await cacheSet("k", 1, 60_000, { hash: "h" });
    await swr(makeResource("k", fetcher), {});
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("keeps stale data on screen when the refresh fails", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "h" });
    const onData = jest.fn();
    const onError = jest.fn();

    await swr(
      makeResource("k", async () => {
        throw new Error("offline");
      }),
      { onData, onError },
    );

    expect(onData).toHaveBeenCalledWith({ n: 1 }, { fromCache: true });
    expect(onError).toHaveBeenCalled();
    expect((await cacheGet<{ n: number }>("k"))?.data).toEqual({ n: 1 });
  });

  it("ensure() falls back to stale data instead of throwing", async () => {
    await cacheSet("k", { n: 1 }, -1, { hash: "h" });
    const entry = await ensure(
      makeResource<{ n: number }>("k", async () => {
        throw new Error("offline");
      }),
    );
    expect(entry.data).toEqual({ n: 1 });
  });

  it("ensure() throws when there is nothing to fall back on", async () => {
    await expect(
      ensure(
        makeResource("k", async () => {
          throw new Error("offline");
        }),
      ),
    ).rejects.toThrow("offline");
  });
});

describe("request coalescing", () => {
  it("collapses concurrent revalidations of one key into a single fetch", async () => {
    // Built up front: `ensure` awaits a cache read before it ever calls the
    // fetcher, so the resolver must already exist when the test releases it.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = jest.fn(async () => {
      await gate;
      return { status: "ok" as const, data: 42, meta: { hash: "h" } };
    });
    const resource = makeResource("k", fetcher);

    const all = Promise.all([ensure(resource), ensure(resource), ensure(resource)]);
    release();
    const entries = await all;

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(entries.map((e) => e.data)).toEqual([42, 42, 42]);
  });
});

describe("eviction", () => {
  it("sweeps entries left behind by a previous API base URL", async () => {
    setNamespace("http://old");
    await cacheSet("stale-server", { n: 1 }, 1000, { hash: "h" });

    setNamespace("http://new");
    // Any write triggers a sweep; the foreign-namespace record goes with it.
    await cacheSet("fresh-server", { n: 2 }, 1000, { hash: "h" });

    setNamespace("http://old");
    expect(await cacheGet("stale-server")).toBeNull();
  });

  it("keeps pinned entries and drops the least recently used ones", async () => {
    const pinned: Resource<number> = { key: "pinned", ttlMs: 1000, pinned: true, fetcher: jest.fn() };
    await cacheSet(pinned.key, 1, 1000, { hash: "h" }, true);

    // Comfortably past MAX_ENTRIES (240) so the LRU pass has to act.
    for (let i = 0; i < 260; i++) {
      await cacheSet(`k${i}`, i, 1000, { hash: `h${i}` });
    }

    expect((await cacheGet<number>("pinned"))?.data).toBe(1);
    // Oldest unpinned entries are gone; the newest survive.
    expect(await cacheGet("k0")).toBeNull();
    expect((await cacheGet<number>("k259"))?.data).toBe(259);
  });
});

describe("isStale", () => {
  it("is false inside the ttl and true past it", () => {
    const now = Date.now();
    expect(isStale({ key: "k", data: 1, fetchedAt: now, ttl: 1000, hash: "h" })).toBe(false);
    expect(isStale({ key: "k", data: 1, fetchedAt: now - 2000, ttl: 1000, hash: "h" })).toBe(true);
  });
});

describe("synchronous peek", () => {
  it("returns an in-memory payload without awaiting", async () => {
    await cacheSet("k", { n: 1 }, 1000, { hash: "h" });
    expect(cachePeek<{ n: number }>("k")).toEqual({ n: 1 });
  });

  it("returns null for a key that was never cached", () => {
    expect(cachePeek("missing")).toBeNull();
  });

  it("does not leak across namespaces", async () => {
    setNamespace("http://a");
    await cacheSet("k", { n: 1 }, 1000, { hash: "h" });
    setNamespace("http://b");
    expect(cachePeek("k")).toBeNull();
  });
});

describe("revalidation status", () => {
  it("brackets a request with true then false, whoever started it", async () => {
    await cacheSet("k", { n: 1 }, 1000, { hash: "old" });

    const seen: boolean[] = [];
    subscribeStatus("k", (v) => seen.push(v));

    // `ensure` is the path kvfPreload uses, and it takes no callbacks of its
    // own — the status broadcast is the only way a screen learns about it.
    await ensure(
      makeResource("k", async () => ({ status: "ok" as const, data: { n: 2 }, meta: { hash: "new" } })),
      true,
    );

    expect(seen).toEqual([true, false]);
    expect(isRevalidating("k")).toBe(false);
  });

  it("reports false again after a failed revalidation", async () => {
    await cacheSet("k", { n: 1 }, 1000, { hash: "old" });

    const seen: boolean[] = [];
    subscribeStatus("k", (v) => seen.push(v));

    await ensure(
      makeResource("k", async () => {
        throw new Error("offline");
      }),
      true,
    );

    expect(seen).toEqual([true, false]);
  });

  it("announces one request when concurrent callers collapse onto it", async () => {
    const seen: boolean[] = [];
    subscribeStatus("k", (v) => seen.push(v));

    const resource = makeResource("k", async () => ({ status: "ok" as const, data: { n: 1 }, meta: { hash: "h" } }));
    await Promise.all([ensure(resource), ensure(resource)]);

    expect(seen).toEqual([true, false]);
  });

  it("stops delivering after unsubscribe", async () => {
    const seen: boolean[] = [];
    const off = subscribeStatus("k", (v) => seen.push(v));
    off();

    await ensure(makeResource("k", async () => ({ status: "ok" as const, data: { n: 1 }, meta: { hash: "h" } })));
    expect(seen).toEqual([]);
  });
});

it("returns oversized fetched data even when the disk budget evicts it immediately", async () => {
  const data = "x".repeat(13 * 1024 * 1024);
  const entry = await cacheSet("oversized", data, 1000, { hash: "large" });
  expect(entry.data).toBe(data);
  expect(await cacheGet("oversized")).toBeNull();
});

it("does not serve an old payload with new metadata after a failed disk write", async () => {
  const fs = require("expo-file-system/legacy");
  await cacheSet("k", { n: 1 }, 1000, { hash: "old" });
  fs.moveAsync.mockRejectedValueOnce(new Error("Disk full"));
  await cacheSet("k", { n: 2 }, 1000, { hash: "new" });
  expect((await cacheGet<{ n: number }>("k"))?.data.n).toBe(2);
  await flushIndex();
  __resetForTests();
  expect(await cacheGet("k")).toBeNull();
});

it("serializes concurrent writes to the same payload file", async () => {
  await Promise.all(Array.from({ length: 8 }, (_, n) => cacheSet("shared", { n }, 1000, { hash: String(n) })));
  await flushIndex();
  __resetForTests();
  const entry = await cacheGet<{ n: number }>("shared");
  expect(entry?.data).toEqual({ n: 7 });
  expect(entry?.hash).toBe("7");
});

it("expires at the TTL boundary and after the clock moves backwards", () => {
  const now = Date.now();
  expect(isStale({ key: "k", data: 1, hash: "h", fetchedAt: now - 1000, ttl: 1000 })).toBe(true);
  expect(isStale({ key: "k", data: 1, hash: "h", fetchedAt: now + 10000, ttl: 1000 })).toBe(true);
});
