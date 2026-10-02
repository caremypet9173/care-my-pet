import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: t("privacy"),
    robots: { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  const t = useTranslations("copy");
  return (
    <Section>
      <Container width="prose">
        <div className="page-heading">
          <Badge>{t("draft")}</Badge>
          <h1>{t("yourDataPrivacy")}</h1>
          <p>{t("thisPageDescribesTheCurrentAppPreview")}</p>
        </div>
        <div className="prose">
          <section>
            <h2>{t("publicPetRecord")}</h2>
            <p>{t("lunasExampleContainsFictionalDataItDoes")}</p>
          </section>
          <section>
            <h2>{t("filesAndConnectionsInThePreview")}</h2>
            <p>{t("photosIconsAndFontsAreServedBy")}</p>
          </section>
          <section>
            <h2>{t("beforeAccountsBecomeAvailable")}</h2>
            <p>{t("thisDocumentStillNeedsTheDataControllers")}</p>
          </section>
        </div>
      </Container>
    </Section>
  );
}
