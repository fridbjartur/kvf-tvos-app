export type AppConfig = {
  apiBaseUrl: string;
};

const defaultApiBaseUrl = "http://localhost:3000";

export const appConfig: AppConfig = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl
};
