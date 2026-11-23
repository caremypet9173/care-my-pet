import { defineRouting } from "next-intl/routing";
// Route identifiers stay stable across languages; the locale prefix changes.
export const routing = defineRouting({
  locales: ["pl", "en"],
  defaultLocale: "pl",
  localePrefix: "always",
  localeDetection: false,
});
