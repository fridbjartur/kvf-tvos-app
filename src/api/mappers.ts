import type {
  ContentSection,
  EpisodeDetailApi,
  FrontPageApi,
  HomeRail,
  HomeSectionData,
  HomeScreenData,
  PlayableEpisodeModel,
  ProgramDetailModel,
  ProgramEpisodeModel,
  ProgramPageApi
} from "./types";
import { getSectionBadge } from "../utils/content";

export function mapFrontPagesToHomeScreenData(pages: FrontPageApi[]): HomeScreenData {
  const heroes = pages.flatMap((page) =>
    page.featuredPrograms.map((item) => ({
      id: `${page.section}:${item.slug}`,
      section: page.section,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      imageUrl: item.thumbnailUrl,
      canOpenProgram: Boolean(item.apiProgramUrl)
    }))
  );

  const rails = pages.flatMap((page) => page.categories.map((category) => mapCategoryToRail(page.section, category)));

  return {
    heroes,
    rails
  };
}

export function selectHomeSectionData(
  data: HomeScreenData,
  section: ContentSection
): HomeSectionData {
  return {
    section,
    heroes: data.heroes.filter((hero) => hero.section === section),
    rails: data.rails.filter((rail) => rail.section === section)
  };
}

function mapCategoryToRail(
  section: ContentSection,
  category: FrontPageApi["categories"][number]
): HomeRail {
  return {
    id: `${section}:${category.id ?? category.title}`,
    title: category.title,
    section,
    items: category.programs.map((program) => ({
      id: `${section}:${program.slug}:${program.path}`,
      section,
      slug: program.slug,
      title: program.title,
      imageUrl: program.thumbnailUrl,
      canOpenProgram: Boolean(program.apiProgramUrl),
      badge: getSectionBadge(section)
    }))
  };
}

export function mapProgramPageToModel(page: ProgramPageApi): ProgramDetailModel {
  const episodes = page.episodes.map(
    (episode): ProgramEpisodeModel => ({
      id: `${page.section}:${episode.slug}:${episode.sid}`,
      sid: episode.sid,
      slug: episode.slug,
      title: episode.title,
      publishDate: episode.publishDate,
      imageUrl: episode.thumbnailUrl
    })
  );

  return {
    section: page.section,
    slug: page.program.slug,
    title: page.program.title,
    description: page.program.description,
    imageUrl: page.program.thumbnailUrl,
    currentEpisodeSid: page.currentEpisodeSid,
    primaryEpisode: selectPrimaryEpisode(page.currentEpisodeSid, episodes),
    episodes
  };
}

export function mapEpisodeDetailToPlayableEpisode(
  detail: EpisodeDetailApi,
  section: ContentSection
): PlayableEpisodeModel {
  return {
    section,
    sid: detail.sid,
    slug: detail.slug,
    title: detail.title,
    publishDate: detail.publishDate,
    imageUrl: detail.thumbnailUrl,
    streamUrl: detail.streamUrl,
    playbackAvailable: detail.playbackAvailable,
    sourceEpisodeUrl: detail.source.episodeUrl
  };
}

export function selectPrimaryEpisode(
  currentEpisodeSid: string | null,
  episodes: ProgramEpisodeModel[]
): ProgramEpisodeModel | null {
  if (!episodes.length) {
    return null;
  }

  if (currentEpisodeSid) {
    const currentEpisode = episodes.find((episode) => episode.sid === currentEpisodeSid);

    if (currentEpisode) {
      return currentEpisode;
    }
  }

  return episodes[0] ?? null;
}
