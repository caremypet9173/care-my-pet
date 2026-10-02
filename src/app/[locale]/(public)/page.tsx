import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Hero } from "@/features/marketing/hero";
import { FeatureOverview } from "@/features/marketing/feature-overview";
import { SectionHeading } from "@/features/marketing/section-heading";
import { ClosingCta } from "@/features/marketing/closing-cta";
import { ImportSteps } from "@/features/documents/import-steps";
import { PetRecordPreview } from "@/features/pets/pet-record-preview";
import { getLuna } from "@/fixtures/demo/luna";

export default function HomePage() {
  const t = useTranslations("copy");
  return (
    <>
      <Hero />
      <FeatureOverview />
      <Section id="demo-kartoteka" aria-labelledby="demo-title">
        <Container>
          <SectionHeading
            id="demo-title"
            badge={t("sampleData")}
            title={t("seeHowYouCanOrganiseYourPets")}
            description={t("fromAVisitToASpecificResult")}
          />
          <div className="demo-width">
            <PetRecordPreview pet={getLuna(t)} />
          </div>
        </Container>
      </Section>
      <Section aria-labelledby="steps-title">
        <Container>
          <SectionHeading
            id="steps-title"
            badge={t("howItWorksFictionalData70")}
            title={t("fromAPhotoOfATestReport")}
            description={t("youDecideWhatToSaveAiPrepares")}
          />
          <ImportSteps />
          <ClosingCta />
        </Container>
      </Section>
    </>
  );
}
