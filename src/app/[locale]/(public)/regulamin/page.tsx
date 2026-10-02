import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: t("terms"),
    robots: { index: false, follow: true },
  };
}

export default function TermsPage() {
  const t = useTranslations("copy");
  return (
    <Section>
      <Container width="prose">
        <div className="page-heading">
          <Badge>{t("draft")}</Badge>
          <h1>{t("termsOfUse")}</h1>
          <p>{t("aPublicSamplePetRecordWithFictional")}</p>
        </div>
        <div className="prose">
          <p>{t("beforeAccountsBecomeAvailableTheFullTerms")}</p>
          <p>{t("careMyPetDoesNotReplaceVeterinary")}</p>
          <ButtonLink href="/demo/luna" variant="secondary">
            {t("goToTheSamplePetRecord")}
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
