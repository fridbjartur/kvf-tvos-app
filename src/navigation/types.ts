export type RootStackParamList = {
  Home: undefined;
  Live: undefined;
  ProgramDetail: {
    section: "sjon" | "vit";
    slug: string;
    sid?: string;
  };
  // VOD playback fetches from API; live playback passes streamUrl directly
  Playback:
    | { section: "sjon" | "vit"; slug: string; sid: string }
    | { streamUrl: string; title: string };
};
