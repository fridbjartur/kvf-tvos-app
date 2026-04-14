export type ContentSection = "sjon" | "vit";

export type ProgramCardApi = {
  title: string;
  slug: string;
  url: string;
  path: string;
  thumbnailUrl: string | null;
  apiProgramUrl: string | null;
};

export type FeaturedProgramApi = ProgramCardApi & {
  summary: string | null;
};

export type CategoryApi = {
  id: number | null;
  title: string;
  programCount: number;
  programs: ProgramCardApi[];
};

export type FrontPageApi = {
  fetchedAt: string;
  sourceUrl: string;
  section: ContentSection;
  featuredPrograms: FeaturedProgramApi[];
  categories: CategoryApi[];
};

export type EpisodeApi = {
  sid: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
  episodeUrl: string;
  slug: string;
};

export type ProgramPageApi = {
  sourceUrl: string;
  finalUrl: string;
  section: ContentSection;
  program: ProgramCardApi & {
    description: string | null;
  };
  currentEpisodeSid: string | null;
  episodes: EpisodeApi[];
  pager: {
    pagesScraped: number;
    hasMore: boolean;
    nextPageUrl: string | null;
  };
};

export type EpisodeDetailApi = {
  sid: string;
  slug: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
  streamUrl: string | null;
  playbackAvailable: boolean;
  source: {
    media: string | null;
    created: string | null;
    episodeUrl: string;
  };
};

export type HomeHeroItem = {
  id: string;
  section: ContentSection;
  slug: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  canOpenProgram: boolean;
};

export type HomeRailItem = {
  id: string;
  section: ContentSection;
  slug: string;
  title: string;
  imageUrl: string | null;
  canOpenProgram: boolean;
  badge: string;
};

export type HomeRail = {
  id: string;
  title: string;
  section: ContentSection;
  items: HomeRailItem[];
};

export type HomeScreenData = {
  heroes: HomeHeroItem[];
  rails: HomeRail[];
};

export type HomeSectionData = {
  section: ContentSection;
  heroes: HomeHeroItem[];
  rails: HomeRail[];
};

export type ProgramEpisodeModel = {
  id: string;
  sid: string;
  slug: string;
  title: string;
  publishDate: string | null;
  imageUrl: string | null;
};

export type ProgramDetailModel = {
  section: ContentSection;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  currentEpisodeSid: string | null;
  primaryEpisode: ProgramEpisodeModel | null;
  episodes: ProgramEpisodeModel[];
};

export type PlayableEpisodeModel = {
  section: ContentSection;
  sid: string;
  slug: string;
  title: string;
  publishDate: string | null;
  imageUrl: string | null;
  streamUrl: string | null;
  playbackAvailable: boolean;
  sourceEpisodeUrl: string;
};
