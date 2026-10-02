import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { inter, jakarta } from "@/lib/fonts";
import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: {
      default: t("careMyPetMoreMomentsTogether"),
      template: "%s | Care My Pet",
    },
    description: t("yourDogOrCatsTestsVisitsAnd"),
    icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("copy");
  return (
    <html
      lang={locale}
      data-theme="signature"
      className={`${jakarta.variable} ${inter.variable}`}
    >
      <body>
        <a className="skip-link" href="#main-content">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
