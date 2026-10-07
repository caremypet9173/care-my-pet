import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: t("privacy"),
    robots: { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  return <LegalDocument document="privacy" />;
}
