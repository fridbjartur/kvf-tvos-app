/** Validate fields consumed by the UI before network data enters the cache. */
import type { EpisodeDetail, FrontPage, ProgramPage, SchedulePage } from "@/types/kvf";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid KVF response: expected an object");
  return value as ObjectValue;
}
function text(value: unknown): void {
  if (typeof value !== "string") throw new Error("Invalid KVF response: expected text");
}
function optionalText(value: unknown): void {
  if (value != null) text(value);
}
function array(value: unknown, validate: (item: unknown) => void): void {
  if (!Array.isArray(value)) throw new Error("Invalid KVF response: expected a list");
  value.forEach(validate);
}
function card(value: unknown): void {
  const item = object(value);
  text(item.title);
  text(item.slug);
  optionalText(item.thumbnailUrl);
  optionalText(item.apiProgramUrl);
}
export function validateFrontPage(value: unknown): FrontPage {
  const page = object(value);
  array(page.featuredPrograms, (item) => {
    card(item);
    optionalText(object(item).summary);
  });
  array(page.categories, (item) => {
    const category = object(item);
    text(category.title);
    array(category.programs, card);
  });
  return value as FrontPage;
}
export function validateProgramPage(value: unknown): ProgramPage {
  const page = object(value);
  card(page.program);
  optionalText(object(page.program).description);
  optionalText(page.currentEpisodeSid);
  array(page.episodes, (item) => {
    const episode = object(item);
    text(episode.sid);
    text(episode.slug);
    text(episode.title);
    optionalText(episode.publishDate);
    optionalText(episode.thumbnailUrl);
  });
  return value as ProgramPage;
}
export function validateEpisode(value: unknown): EpisodeDetail {
  const episode = object(value);
  if (episode.streamUrl !== null) {
    text(episode.streamUrl);
    if (!/^https?:\/\/[^\s]+$/i.test(episode.streamUrl as string)) throw new Error("Invalid KVF response: unsupported stream URL");
  }
  return value as EpisodeDetail;
}
export function validateSchedule(value: unknown): SchedulePage {
  const page = object(value);
  text(page.date);
  for (const field of ["dateLabel", "weekday", "previousDate", "nextDate"]) optionalText(page[field]);
  array(page.entries, (item) => {
    const entry = object(item);
    text(entry.title);
    text(entry.startTime);
    text(entry.startsAt);
    for (const field of ["endTime", "endsAt", "subtitle", "description", "producer", "thumbnailUrl"]) optionalText(entry[field]);
    if (entry.program != null) card(entry.program);
    array(entry.music, (track) => {
      text(object(track).title);
      optionalText(object(track).artist);
    });
  });
  if (page.nowPlaying != null) text(object(page.nowPlaying).startsAt);
  return value as SchedulePage;
}
