import type messages from "./messages/pl.json";
export type Locale = "pl" | "en";
export type Translator = (key: keyof typeof messages.copy) => string;
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
