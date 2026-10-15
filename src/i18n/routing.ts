import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "kk", "en"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
};
