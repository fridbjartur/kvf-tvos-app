import type { ContentSection } from "../api/types";
import { t } from "../locales";

export function getSectionLabel(section: ContentSection) {
  return section === "sjon" ? t("section.sjon") : t("section.vit");
}

export function getSectionBadge(section: ContentSection) {
  return section === "sjon" ? t("badge.sjon") : t("badge.vit");
}

export function getUnavailableLabel() {
  return t("common.unavailable");
}

export function getHeroFallbackSummary() {
  return t("hero.fallbackSummary");
}

export function getRetryLabel() {
  return t("common.retry");
}

export function getBackLabel() {
  return t("common.back");
}

export function getProgramPlayLabel() {
  return t("program.play");
}

export function getOpenProgramLabel() {
  return t("hero.openProgram");
}

export function getProgramEpisodesLabel() {
  return t("program.episodes");
}

export function getEpisodeBadgeLabel() {
  return t("program.episodeBadge");
}

export function getHomeConnectionIssueLabel() {
  return t("home.connectionIssue");
}

export function getHomeLoadErrorTitle() {
  return t("home.loadErrorTitle");
}

export function getHomeEmptyEyebrow() {
  return t("home.emptyEyebrow");
}

export function getHomeEmptyTitle() {
  return t("home.emptyTitle");
}

export function getProgramLoadErrorTitle() {
  return t("program.loadErrorTitle");
}

export function getProgramNoEpisodesAvailableLabel() {
  return t("program.noEpisodesAvailable");
}

export function getProgramNoEpisodesYetLabel() {
  return t("program.noEpisodesYet");
}

export function getPlaybackLoadErrorTitle() {
  return t("playback.loadErrorTitle");
}

export function getPlaybackUnavailableTitle() {
  return t("playback.unavailableTitle");
}

export function getPlaybackUnavailableBody() {
  return t("playback.unavailableBody");
}

export function getEpisodeCountLabel(count: number) {
  return t("program.episodeCount", { count });
}

export function formatPublishDate(date: string | null) {
  if (!date) {
    return t("common.dateUnavailable");
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.valueOf())) {
    return date;
  }

  return new Intl.DateTimeFormat("fo-FO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
}
