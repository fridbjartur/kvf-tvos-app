// KVF API types — mirrors kvf-scraper-api/src/lib/types.ts
//
// `listKey` is NOT part of the API payload: kvfApi attaches it client-side
// (see utils/keys.ts) so React lists always have unique, stable keys even
// when the API returns duplicate or missing slugs/sids.
//
// Sections are identified app-side by `SectionId` (constants/sections.ts). The
// wire format uses the nested path form (`sjon/vit`) — that's `ApiSectionPath`.

import type { ApiSectionPath, Channel, SectionId } from "@/constants/sections";

export type { ApiSectionPath, Channel, SectionId };

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

/**
 * A program in the merged search index, tagged with the section whose endpoint
 * serves it. Tagged at merge time rather than sniffed from `path`, which can no
 * longer tell `sjon/vit` from `ljod/vit`.
 */
export interface IndexedProgram extends ProgramCard {
  sectionId: SectionId;
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
  section: ApiSectionPath;
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
  section: ApiSectionPath;
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
  section: SectionId;
  thumbnailUrl: string | null;
}

// ── Broadcast schedule (skrá) ─────────────────────────────────────────────────

export interface MusicTrack {
  title: string;
  artist: string | null;
  /** Unique render key, attached client-side by kvfApi. */
  listKey: string;
}

export interface ScheduleEntry {
  /** KVF's printed clock times. */
  startTime: string;
  endTime: string | null;
  /** The same instants resolved against Atlantic/Faroe — compare these to now. */
  startsAt: string;
  endsAt: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  producer: string | null;
  thumbnailUrl: string | null;
  isLive: boolean;
  faroeIslandsOnly: boolean;
  /** Set when KVF links the row to a program page. `apiProgramUrl` may still be null. */
  program: ProgramCard | null;
  /** The logged playlist — radio only, and empty until the program has aired. */
  music: MusicTrack[];
  /** Unique render key, attached client-side by kvfApi. */
  listKey: string;
}

export interface SchedulePage {
  fetchedAt: string;
  sourceUrl: string;
  channel: Channel;
  date: string;
  weekday: string | null;
  dateLabel: string | null;
  previousDate: string | null;
  nextDate: string | null;
  /** The entry KVF flags as on air, hoisted. Reference-identical to its row in `entries`. */
  nowPlaying: ScheduleEntry | null;
  entries: ScheduleEntry[];
}
