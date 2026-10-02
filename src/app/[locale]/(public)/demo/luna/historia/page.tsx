import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { RecordHistory } from "@/features/records/record-history";
import { getLunaEvents } from "@/fixtures/demo/luna-record";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return { title: t("lunasHealthHistoryDemo") };
}
export default function HistoryPage() {
  const t = useTranslations("copy");
  return <RecordHistory events={getLunaEvents(t)} />;
}
