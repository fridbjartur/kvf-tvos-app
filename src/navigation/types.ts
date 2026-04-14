export type RootStackParamList = {
  Home: undefined;
  ProgramDetail: {
    section: "sjon" | "vit";
    slug: string;
    sid?: string;
  };
  Playback: {
    section: "sjon" | "vit";
    slug: string;
    sid: string;
  };
};
