import { mapEpisodeDetailToPlayableEpisode, selectPrimaryEpisode } from "../api/mappers";
import type { EpisodeDetailApi, ProgramEpisodeModel } from "../api/types";

describe("selectPrimaryEpisode", () => {
  test("falls back to the first episode when current sid is missing", () => {
    const episodes: ProgramEpisodeModel[] = [
      {
        id: "1",
        sid: "1",
        slug: "dv",
        title: "First",
        publishDate: "2026-04-01",
        imageUrl: null
      },
      {
        id: "2",
        sid: "2",
        slug: "dv",
        title: "Second",
        publishDate: "2026-04-02",
        imageUrl: null
      }
    ];

    expect(selectPrimaryEpisode("999", episodes)?.sid).toBe("1");
  });
});

describe("mapEpisodeDetailToPlayableEpisode", () => {
  test("preserves playback availability when stream URL is missing", () => {
    const input: EpisodeDetailApi = {
      sid: "99",
      slug: "dv",
      title: "Unavailable episode",
      publishDate: null,
      thumbnailUrl: null,
      streamUrl: null,
      playbackAvailable: false,
      source: {
        media: null,
        created: null,
        episodeUrl: "https://kvf.fo/example"
      }
    };

    const result = mapEpisodeDetailToPlayableEpisode(input, "sjon");

    expect(result.playbackAvailable).toBe(false);
    expect(result.streamUrl).toBeNull();
    expect(result.sourceEpisodeUrl).toContain("kvf.fo");
  });
});
