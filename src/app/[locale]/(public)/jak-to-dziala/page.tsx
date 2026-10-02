import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { ImportSteps } from "@/features/documents/import-steps";
import { ClosingCta } from "@/features/marketing/closing-cta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return { title: t("howItWorks") };
}

export default function HowPage() {
  const t = useTranslations("copy");
  return (
    <Section>
      <Container>
        <div className="page-heading">
          <Badge dot>{t("howItWorksFictionalData")}</Badge>
          <h1>{t("youDecideWhatToSave")}</h1>
          <p>{t("fromADocumentToAnEntryIn")}</p>
        </div>
        <h2 className="sr-only">{t("threeStepsToAnOrganisedPetRecord")}</h2>
        <ImportSteps />
        <div className="faq">
          <h2>{t("goodToKnow")}</h2>
          <details>
            <summary>{t("canTheExtractedTextContainErrors")}</summary>
            <p>{t("yesBeforeSavingCompareValuesUnitsAnd")}</p>
          </details>
          <details>
            <summary>{t("isTheDocumentAutomaticallySavedToThe")}</summary>
            <p>{t("theExtractedDraftNeedsYourApprovalRecognising")}</p>
          </details>
          <details>
            <summary>{t("doesTheAppMakeADiagnosis")}</summary>
            <p>{t("noItHelpsOrganiseRecordsDiscussResults")}</p>
          </details>
          <details>
            <summary>{t("canIAddADocumentToThe")}</summary>
            <p>{t("noThePublicRecordContainsFictionalData")}</p>
          </details>
        </div>
        <ClosingCta />
      </Container>
    </Section>
  );
}
