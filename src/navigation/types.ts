export type RootStackParamList = {
  Home: undefined;
  Live: undefined;
  ProgramDetail: {
    section: "sjon" | "vit";
    slug: string;
    sid?: string;
  };
};
