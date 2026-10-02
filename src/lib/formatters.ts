import { useLocale } from "next-intl";

export function useFormatters() {
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-GB" : "pl-PL";
  const number = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 2,
  });
  const date = new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const month = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    locale,
    formatNumber: (value: number) => number.format(value),
    formatDate: (value: string) => date.format(new Date(`${value}T12:00:00Z`)),
    formatMonth: (value: string) =>
      month.format(new Date(`${value}T12:00:00Z`)),
  };
}
