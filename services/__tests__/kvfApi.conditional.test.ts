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
import { SECTION_IDS, SECTIONS } from "@/constants/sections";
import type { ApiSectionPath, FrontPage } from "@/types/kvf";

const API_PATHS = SECTION_IDS.map((id) => SECTIONS[id].apiPath);

function frontPage(section: ApiSectionPath, titles: string[], apiProgramUrlFor?: (title: string) => string | null): FrontPage {
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
        programs: titles.map((t) => ({
          title: t,
          slug: t.toLowerCase(),
          url: "",
          path: `/${section}/`,
          thumbnailUrl: null,
          apiProgramUrl: apiProgramUrlFor?.(t) ?? null,
          listKey: t.toLowerCase(),
        })),
      },
    ],
  } as FrontPage;
}

/**
 * Serve a front page per section, dispatching on the exact path a URL ends
 * with. `/api/sjon` does not match `/api/sjon/vit`, so the nested sections
 * cannot be shadowed by their parent.
 */
function serveFrontPages(titles: Partial<Record<ApiSectionPath, string[]>>, failing: ApiSectionPath[] = []) {
  return async (url: string) => {
    const path = API_PATHS.find((p) => url.endsWith(`/api/${p}`));
    if (!path) throw new Error(`unexpected request: ${url}`);
    // 404 rather than 503: a permanent failure is not retried, so the test
    // does not sit through the backoff.
    if (failing.includes(path)) return jsonResponse({}, {}, 404);
    return jsonResponse(frontPage(path, titles[path] ?? []));
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
    fetchMock.mockResolvedValueOnce(jsonResponse({}, {}, 503)).mockResolvedValueOnce(jsonResponse(frontPage("sjon/vit", ["A"])));

    const entry = await ensure(frontPageResource("sjon-vit"));

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
  it("merges every front page without issuing extra requests", async () => {
    fetchMock.mockImplementation(serveFrontPages({ sjon: ["Beta", "Alpha"], "sjon/vit": ["Gamma"], ljod: ["Delta"] }));

    const entry = await ensure(allProgramsResource());

    // One request per section and nothing more — the index costs no network of its own.
    expect(fetchMock).toHaveBeenCalledTimes(SECTION_IDS.length);
    expect(entry.data.map((p) => p.title)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
  });

  it("makes radio programs searchable", async () => {
    fetchMock.mockImplementation(serveFrontPages({ ljod: ["Útvarpssøga"], "ljod/vit": ["Barnatíðindi"] }));

    const entry = await ensure(allProgramsResource());

    expect(entry.data.map((p) => p.title)).toEqual(["Barnatíðindi", "Útvarpssøga"]);
  });

  it("deduplicates programs that appear in more than one section", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(frontPage("sjon", ["Same"])));
    const entry = await ensure(allProgramsResource());
    expect(entry.data).toHaveLength(1);
  });

  it("tags each program with the section its apiProgramUrl points at", async () => {
    // A card on the sjon front page whose canonical endpoint lives under ljod.
    fetchMock.mockImplementation(async (url: string) => {
      const path = API_PATHS.find((p) => url.endsWith(`/api/${p}`))!;
      if (path === "sjon") return jsonResponse(frontPage("sjon", ["Crossover"], () => "/api/ljod/programs/crossover"));
      return jsonResponse(frontPage(path, []));
    });

    const entry = await ensure(allProgramsResource());

    expect(entry.data[0].sectionId).toBe("ljod");
  });

  it("does not let a parent section shadow its nested one", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = API_PATHS.find((p) => url.endsWith(`/api/${p}`))!;
      if (path === "sjon") return jsonResponse(frontPage("sjon", ["Kids"], () => "/api/sjon/vit/programs/kids"));
      return jsonResponse(frontPage(path, []));
    });

    const entry = await ensure(allProgramsResource());

    expect(entry.data[0].sectionId).toBe("sjon-vit");
  });

  it("falls back to the source front page when apiProgramUrl is null", async () => {
    fetchMock.mockImplementation(serveFrontPages({ "sjon/miks": ["Miks Show"] }));

    const entry = await ensure(allProgramsResource());

    expect(entry.data[0].sectionId).toBe("sjon-miks");
  });

  it("still builds an index when one front page fails", async () => {
    fetchMock.mockImplementation(serveFrontPages({ sjon: ["Alpha"], ljod: ["Beta"] }, ["ljod"]));

    const entry = await ensure(allProgramsResource());

    expect(entry.data.map((p) => p.title)).toEqual(["Alpha"]);
  });

  it("rebuilds the index once a failed section recovers", async () => {
    fetchMock.mockImplementation(serveFrontPages({ sjon: ["Alpha"], ljod: ["Beta"] }, ["ljod"]));
    const first = await ensure(allProgramsResource());

    // The "x" placeholder in the hash is what makes the recovery register as a
    // change; without it the incomplete index would look unchanged forever.
    fetchMock.mockImplementation(serveFrontPages({ sjon: ["Alpha"], ljod: ["Beta"] }));
    const second = await ensure(allProgramsResource(), true);

    expect(second.data).not.toBe(first.data);
    expect(second.data.map((p) => p.title)).toEqual(["Alpha", "Beta"]);
  });

  it("keeps its cached array when no front page changed", async () => {
    fetchMock.mockImplementation(serveFrontPages({ sjon: ["A"], ljod: ["B"] }));

    const first = await ensure(allProgramsResource());
    const second = await ensure(allProgramsResource(), true);

    expect(second.data).toBe(first.data);
  });
});
