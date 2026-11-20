import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ResultsExplorer } from "@/features/lab-results/results-explorer";
import { getLunaReport, creatinineTrend } from "@/fixtures/demo/luna-record";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return { title: t("lunasTestResultsDemo") };
}
export default function ResultsPage() {
  const t = useTranslations("copy");
  return <ResultsExplorer report={getLunaReport(t)} trend={creatinineTrend} />;
}
