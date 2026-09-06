// KVF API types — mirrors kvf-scraper-api/src/lib/types.ts
//
// `listKey` is NOT part of the API payload: kvfApi attaches it client-side
// (see utils/keys.ts) so React lists always have unique, stable keys even
// when the API returns duplicate or missing slugs/sids.

export type Section = "sjon" | "vit";

export interface ProgramCard {
  title: string;
  slug: string;
  url: string;
  path: string;
  thumbnailUrl: string | null;
  apiProgramUrl: string | null;
  /** Unique render key, attached client-side by kvfApi. */
  listKey: string;
}

export interface FeaturedProgram extends ProgramCard {
  summary: string | null;
}

export interface Category {
  id: number | null;
  title: string;
  programCount: number;
  programs: ProgramCard[];
  /** Unique render key, attached client-side by kvfApi. */
  listKey: string;
}

export interface FrontPage {
  fetchedAt: string;
  sourceUrl: string;
  section: Section;
  featuredPrograms: FeaturedProgram[];
  categories: Category[];
}

export interface Episode {
  sid: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
  episodeUrl: string;
  slug: string;
  /** Unique render key, attached client-side by kvfApi. */
  listKey: string;
}

export interface ProgramPage {
  sourceUrl: string;
  finalUrl: string;
  section: Section;
  program: ProgramCard & {
    description: string | null;
  };
  currentEpisodeSid: string | null;
  episodes: Episode[];
  pager: {
    pagesScraped: number;
    hasMore: boolean;
    nextPageUrl: string | null;
  };
}

export interface EpisodeDetail {
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
}

/** Minimal episode info used for the play queue. */
export interface QueueEpisode {
  sid: string;
  slug: string;
  title: string;
  section: Section;
  thumbnailUrl: string | null;
}
