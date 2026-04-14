import { kvfApi } from "../api/client";
import { useCachedResource } from "./useCachedResource";

/** Home data stays fresh for 5 minutes. After that a background re-fetch runs. */
const HOME_FRESH_MS = 5 * 60 * 1000;

export function useHomeData() {
  return useCachedResource("home", () => kvfApi.getHomeScreenData(), HOME_FRESH_MS);
}
