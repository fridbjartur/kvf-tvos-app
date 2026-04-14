import { mapFrontPagesToHomeScreenData, mapProgramPageToModel } from "../api/mappers";
import type { FrontPageApi, ProgramPageApi } from "../api/types";

describe("mapFrontPagesToHomeScreenData", () => {
  test("merges sjon and vit into shared hero and rail models", () => {
    const pages: FrontPageApi[] = [
      {
        fetchedAt: "2026-04-13T00:00:00.000Z",
        sourceUrl: "https://example.test/sjon",
        section: "sjon",
        featuredPrograms: [
          {
            title: "Dagur og vika",
            slug: "dv",
            url: "",
            path: "",
            thumbnailUrl: null,
            apiProgramUrl: "/api/sjon/programs/dv",
            summary: "Seinastu tidindi"
          }
        ],
        categories: [
          {
            id: 1,
            title: "Seinast lagt aftrat",
            programCount: 1,
            programs: [
              {
                title: "Dagur og vika",
                slug: "dv",
                url: "",
                path: "/sjon/sending/dv",
                thumbnailUrl: null,
                apiProgramUrl: "/api/sjon/programs/dv"
              }
            ]
          }
        ]
      },
      {
        fetchedAt: "2026-04-13T00:00:00.000Z",
        sourceUrl: "https://example.test/vit",
        section: "vit",
        featuredPrograms: [],
        categories: [
          {
            id: 2,
            title: "Ljóð",
            programCount: 1,
            programs: [
              {
                title: "Vinus og Vimús",
                slug: "vinus-og-vimus",
                url: "",
                path: "/vit/sending/sv/vinus-og-vimus",
                thumbnailUrl: "https://image.test/poster.jpg",
                apiProgramUrl: "/api/vit/programs/vinus-og-vimus"
              }
            ]
          }
        ]
      }
    ];

    const result = mapFrontPagesToHomeScreenData(pages);

    expect(result.heroes).toHaveLength(1);
    expect(result.rails).toHaveLength(2);
    expect(result.rails[1]?.items[0]?.badge).toBe("VIT");
  });
});

describe("mapProgramPageToModel", () => {
  test("selects the current episode when present", () => {
    const page: ProgramPageApi = {
      sourceUrl: "",
      finalUrl: "",
      section: "sjon",
      program: {
        title: "Dagur og vika",
        slug: "dv",
        url: "",
        path: "",
        thumbnailUrl: null,
        apiProgramUrl: "/api/sjon/programs/dv",
        description: "Tidindi"
      },
      currentEpisodeSid: "2",
      episodes: [
        {
          sid: "1",
          slug: "dv",
          title: "Older episode",
          publishDate: "2026-04-01",
          thumbnailUrl: null,
          episodeUrl: ""
        },
        {
          sid: "2",
          slug: "dv",
          title: "Current episode",
          publishDate: "2026-04-10",
          thumbnailUrl: null,
          episodeUrl: ""
        }
      ],
      pager: {
        pagesScraped: 1,
        hasMore: false,
        nextPageUrl: null
      }
    };

    const result = mapProgramPageToModel(page);

    expect(result.primaryEpisode?.sid).toBe("2");
    expect(result.episodes).toHaveLength(2);
  });
});
