import { kvfApi } from "../api/client";
import type { ContentSection } from "../api/types";
import { useCachedResource } from "./useCachedResource";

/** Program pages stay fresh for 3 minutes. Episodes and metadata rarely change faster. */
const PROGRAM_FRESH_MS = 3 * 60 * 1000;

export function useProgramDetail(section: ContentSection, slug: string) {
  return useCachedResource(
    `program:${section}:${slug}`,
    () => kvfApi.getProgram(section, slug),
    PROGRAM_FRESH_MS
  );
}
