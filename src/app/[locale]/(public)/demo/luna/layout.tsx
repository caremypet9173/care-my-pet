import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { IconArrowLeft, IconShieldCheck } from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { ProfileFrame } from "@/features/pets/profile/profile-frame";
import { ProfileNavigation } from "@/features/pets/profile/profile-navigation";
import { getLuna } from "@/fixtures/demo/luna";
import "@/styles/pet-record.css";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: t("lunasSamplePetRecord"),
    robots: { index: false, follow: true },
  };
}
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("copy");
  return (
    <div className="full-record">
      <div className="demo-advisory">
        <Container>
          <Badge dot>{t("fictionalData")}</Badge>
          <span>{t("samplePetRecordReadOnly")}</span>
          <Link href="/" className="demo-back">
            <IconArrowLeft size={16} aria-hidden="true" />
            {t("home")}
          </Link>
        </Container>
      </div>
      <Container>
        <ProfileFrame pet={getLuna(t)} />
        <ProfileNavigation />
        <div className="record-content">{children}</div>
        <p className="record-disclaimer">
          <IconShieldCheck size={20} aria-hidden="true" />
          <span>{t("allDataDocumentsAndHealthInformationIn")}</span>
        </p>
      </Container>
    </div>
  );
}
