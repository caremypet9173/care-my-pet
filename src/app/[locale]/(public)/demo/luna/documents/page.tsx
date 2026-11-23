import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { DocumentBrowser } from "@/features/documents/document-browser";
import { getLunaDocuments, getLunaReport } from "@/fixtures/demo/luna-record";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return { title: t("lunasDocumentsDemo") };
}
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ plik?: string | string[] }>;
}) {
  const t = await getTranslations("copy");
  const { plik } = await searchParams;
  return (
    <DocumentBrowser
      documents={getLunaDocuments(t)}
      report={getLunaReport(t)}
      selectedId={typeof plik === "string" ? plik : undefined}
    />
  );
}
