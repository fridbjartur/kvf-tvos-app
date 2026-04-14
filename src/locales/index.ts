const translations = require("./translations.json") as Record<
  string,
  {
    en: string;
    fo: string;
  }
>;

type TranslationKey = keyof typeof translations;

type TranslationParams = Record<string, string | number>;

const DEFAULT_LANGUAGE = "fo";

export function t(key: TranslationKey, params?: TranslationParams) {
  const entry = translations[key];

  if (!entry) {
    return key;
  }

  const template = entry[DEFAULT_LANGUAGE] ?? entry.en;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [paramKey, value]) => {
    return result.replaceAll(`{${paramKey}}`, String(value));
  }, template);
}

