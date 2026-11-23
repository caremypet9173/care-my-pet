import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { inter, interExt, jakarta, jakartaExt } from "@/lib/fonts";
import { CookieNotice } from "@/components/legal/cookie-notice";
import { NetworkStatus } from "@/components/layout/network-status";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import "@/styles/globals.css";

export const viewport = {
  themeColor: "#1d4a40",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: {
      default: t("careMyPetMoreMomentsTogether"),
      template: "%s | Care My Pet",
    },
    description: t("yourDogOrCatsTestsVisitsAnd"),
    icons: { icon: "/brand/favicon.png", apple: "/brand/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Care My Pet",
    },
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
      className={`${jakarta.variable} ${jakartaExt.variable} ${inter.variable} ${interExt.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main-content">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          {children}
          <CookieNotice />
          <NetworkStatus />
          <PwaProvider />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
