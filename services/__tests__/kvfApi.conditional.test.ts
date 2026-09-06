/**
 * kvfApi — the network behaviours that make a refresh cheap:
 * conditional headers, 304 handling, hash short-circuiting before JSON.parse,
 * timeouts, retry classification, and the derived search index.
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

import { allProgramsResource, episodeResource, frontPageResource } from "../kvfApi";
import { ensure, __resetForTests } from "../kvfCache";
import type { FrontPage } from "@/types/kvf";

function frontPage(section: "sjon" | "vit", titles: string[]): FrontPage {
  return {
    fetchedAt: "2026-01-01",
    sourceUrl: `https://kvf.fo/${section}`,
    section,
    featuredPrograms: [],
    categories: [
      {
        id: 1,
        title: "Cat",
        programCount: titles.length,
        listKey: "1",
        programs: titles.map((t) => ({ title: t, slug: t.toLowerCase(), url: "", path: `/${section}/`, thumbnailUrl: null, apiProgramUrl: null, listKey: t.toLowerCase() })),
      },
    ],
  } as FrontPage;
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

describe("conditional requests", () => {
  it("sends If-None-Match once an ETag is known and treats 304 as unchanged", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(frontPage("sjon", ["A"]), { etag: 'W/"v1"' }));
    const first = await ensure(frontPageResource("sjon"));

    fetchMock.mockResolvedValueOnce({ ok: false, status: 304, text: async () => "", headers: { get: () => null } });
    const second = await ensure(frontPageResource("sjon"), true);

    expect(fetchMock.mock.calls[1][1].headers["If-None-Match"]).toBe('W/"v1"');
    // Same object identity ⇒ nothing downstream re-renders.
    expect(second.data).toBe(first.data);
  });

  it("sends If-Modified-Since when the server only supplies Last-Modified", async () => {
    const lastMod = "Wed, 01 Jan 2026 00:00:00 GMT";
    fetchMock.mockResolvedValueOnce(jsonResponse(frontPage("sjon", ["A"]), { "last-modified": lastMod }));
    await ensure(frontPageResource("sjon"));

    fetchMock.mockResolvedValueOnce(jsonResponse(frontPage("sjon", ["A"])));
    await ensure(frontPageResource("sjon"), true);

    expect(fetchMock.mock.calls[1][1].headers["If-Modified-Since"]).toBe(lastMod);
  });

  it("keeps the cached object when the body is identical but no ETag is offered", async () => {
    const body = frontPage("sjon", ["A", "B"]);
    fetchMock.mockResolvedValue(jsonResponse(body));

    const first = await ensure(frontPageResource("sjon"));
    const second = await ensure(frontPageResource("sjon"), true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.data).toBe(first.data);
  });

  it("replaces the cached object when the body really changed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(frontPage("sjon", ["A"])));
    const first = await ensure(frontPageResource("sjon"));

    fetchMock.mockResolvedValueOnce(jsonResponse(frontPage("sjon", ["A", "B"])));
    const second = await ensure(frontPageResource("sjon"), true);

    expect(second.data).not.toBe(first.data);
    expect(second.data.categories[0].programs).toHaveLength(2);
  });
});

describe("failure handling", () => {
  it("does not retry a 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, {}, 404));
    await expect(ensure(episodeResource("sjon", "s", "1"))).rejects.toThrow("HTTP 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 and succeeds on a later attempt", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, {}, 503)).mockResolvedValueOnce(jsonResponse(frontPage("vit", ["A"])));

    const entry = await ensure(frontPageResource("vit"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(entry.data.categories[0].programs).toHaveLength(1);
  });

  it("surfaces an aborted request as a timeout", async () => {
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";
    fetchMock.mockRejectedValue(abortErr);

    await expect(ensure(frontPageResource("sjon"))).rejects.toThrow(/Request timeout/);
  });

  it("passes an abort signal on every request", async () => {
    fetchMock.mockResolvedValue(jsonResponse(frontPage("sjon", ["A"])));
    await ensure(frontPageResource("sjon"));
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});

describe("derived search index", () => {
  it("merges both front pages without issuing extra requests", async () => {
    fetchMock.mockImplementation(async (url: string) => jsonResponse(url.endsWith("/api/sjon") ? frontPage("sjon", ["Beta", "Alpha"]) : frontPage("vit", ["Gamma"])));

    const entry = await ensure(allProgramsResource());

    // Exactly two requests total — the index costs no network of its own.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(entry.data.map((p) => p.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("deduplicates programs that appear in both sections", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(frontPage("sjon", ["Same"])));
    const entry = await ensure(allProgramsResource());
    expect(entry.data).toHaveLength(1);
  });

  it("keeps its cached array when neither front page changed", async () => {
    fetchMock.mockImplementation(async (url: string) => jsonResponse(url.endsWith("/api/sjon") ? frontPage("sjon", ["A"]) : frontPage("vit", ["B"])));

    const first = await ensure(allProgramsResource());
    const second = await ensure(allProgramsResource(), true);

    expect(second.data).toBe(first.data);
  });
});
