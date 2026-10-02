import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { routing } from "./routing";
export default getRequestConfig(async ({ locale: override }) => {
  const locale = override ?? (await rootParams.locale());
  if (!hasLocale(routing.locales, locale)) notFound();
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
