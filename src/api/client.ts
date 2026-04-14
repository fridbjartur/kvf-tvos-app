import { appConfig } from "../config";
import { mapEpisodeDetailToPlayableEpisode, mapFrontPagesToHomeScreenData, mapProgramPageToModel } from "./mappers";
import type { ContentSection, EpisodeDetailApi, FrontPageApi, HomeScreenData, PlayableEpisodeModel, ProgramDetailModel, ProgramPageApi } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed for ${path} (${response.status})`);
  }

  return (await response.json()) as T;
}

export const kvfApi = {
  async getHomeScreenData(): Promise<HomeScreenData> {
    const [sjon, vit] = await Promise.all([
      getJson<FrontPageApi>("/api/sjon"),
      getJson<FrontPageApi>("/api/vit")
    ]);

    return mapFrontPagesToHomeScreenData([sjon, vit]);
  },

  async getProgram(section: ContentSection, slug: string): Promise<ProgramDetailModel> {
    const response = await getJson<ProgramPageApi>(`/api/${section}/programs/${slug}`);
    return mapProgramPageToModel(response);
  },

  async getEpisode(section: ContentSection, slug: string, sid: string): Promise<PlayableEpisodeModel> {
    const response = await getJson<EpisodeDetailApi>(`/api/${section}/episodes/${slug}/${sid}`);
    return mapEpisodeDetailToPlayableEpisode(response, section);
  }
};
