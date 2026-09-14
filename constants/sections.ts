/**
 * The KVF section tree.
 *
 * The API nests sections one level deep — `sjon`, `sjon/vit`, `sjon/miks`,
 * `ljod`, `ljod/vit` — but a `/` is awkward as an expo-router param and as a
 * cache-key fragment, so the app identifies a section by a flat slug id and
 * keeps the path form confined to the API client.
 *
 * The server still *sends* the path form back, in `FrontPage.section` and
 * inside `ProgramCard.apiProgramUrl`; `sectionIdFromApiPath` and
 * `sectionIdFromApiProgramUrl` translate it.
 */

import strings from "@/constants/strings.json";

export const SECTION_IDS = ["sjon", "sjon-vit", "sjon-miks", "ljod", "ljod-vit"] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** The nested form the API uses in its URLs and payloads. */
export type ApiSectionPath = "sjon" | "sjon/vit" | "sjon/miks" | "ljod" | "ljod/vit";

/** Broadcast channel: `sjon` is TV, `ljod` is radio. Also what /schedule keys on. */
export type Channel = "sjon" | "ljod";

export interface SectionDef {
  id: SectionId;
  apiPath: ApiSectionPath;
  label: string;
  channel: Channel;
  /** Drives which stream the API hands back — ljod sections are audio-only. */
  kind: "video" | "audio";
}

export const SECTIONS: Readonly<Record<SectionId, SectionDef>> = {
  sjon: { id: "sjon", apiPath: "sjon", label: strings.sections.sjon, channel: "sjon", kind: "video" },
  "sjon-vit": { id: "sjon-vit", apiPath: "sjon/vit", label: strings.sections.sjonVit, channel: "sjon", kind: "video" },
  "sjon-miks": { id: "sjon-miks", apiPath: "sjon/miks", label: strings.sections.sjonMiks, channel: "sjon", kind: "video" },
  ljod: { id: "ljod", apiPath: "ljod", label: strings.sections.ljod, channel: "ljod", kind: "audio" },
  "ljod-vit": { id: "ljod-vit", apiPath: "ljod/vit", label: strings.sections.ljodVit, channel: "ljod", kind: "audio" },
};

/** Derived from SECTIONS, so the two can never drift apart. */
const SECTION_ID_BY_API_PATH = new Map<string, SectionId>(SECTION_IDS.map((id) => [SECTIONS[id].apiPath, id]));

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === "string" && (SECTION_IDS as readonly string[]).includes(value);
}

export function sectionIdFromApiPath(path: string): SectionId | null {
  return SECTION_ID_BY_API_PATH.get(path) ?? null;
}

/**
 * Resolve the section a `ProgramCard.apiProgramUrl` points at, e.g.
 * `/api/sjon/vit/programs/node-123` → `sjon-vit`.
 *
 * Deliberately an exact lookup rather than a prefix match: `/api/sjon` is a
 * prefix of `/api/sjon/vit`, so `startsWith` would route every VIT program to
 * Sjón and 404 on the way.
 */
export function sectionIdFromApiProgramUrl(url: string | null | undefined): SectionId | null {
  if (!url) return null;
  const marker = url.indexOf("/programs/");
  if (marker < 0) return null;
  return sectionIdFromApiPath(url.slice(0, marker).replace(/^\/api\//, ""));
}
