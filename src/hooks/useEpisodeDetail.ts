import { kvfApi } from "../api/client";
import type { ContentSection } from "../api/types";
import { useAsyncResource } from "./useAsyncResource";

export function useEpisodeDetail(section: ContentSection, slug: string, sid: string) {
  return useAsyncResource(() => kvfApi.getEpisode(section, slug, sid), [section, slug, sid]);
}
