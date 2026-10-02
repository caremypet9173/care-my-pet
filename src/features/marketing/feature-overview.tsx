import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  IconChevronRight,
  IconCircleCheck,
  IconUsers,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/layout/section";
import { Container } from "@/components/layout/container";

export function FeatureOverview() {
  const t = useTranslations("copy");
  return (
    <Section aria-labelledby="features-title">
      <Container className="feature-grid">
        <div className="feature-intro">
          <span className="eyebrow accent-text">{t("connectionAndCare")}</span>
          <h2 id="features-title">{t("everyPetHasAStory206")}</h2>
          <p>{t("fromFirstVaccinationsToRoutineCheckUps")}</p>
        </div>
        <div className="feature-cards">
          <Card>
            <span className="icon-tile">
              <IconCircleCheck size={24} aria-hidden="true" />
            </span>
            <p>{t("aResultByEmailAPhotoOn")}</p>
            <Link href="/mozliwosci#dokumenty" className="text-link">
              {t("organisedDocuments")}{" "}
              <IconChevronRight size={16} aria-hidden="true" />
            </Link>
          </Card>
          <Card>
            <span className="icon-tile icon-tile--mint">
              <IconUsers size={24} aria-hidden="true" />
            </span>
            <p>{t("shareCareMoreEasilyWithYourPartner")}</p>
            <Link href="/mozliwosci#wspolna-opieka" className="text-link">
              {t("sharedCare")}{" "}
              <IconChevronRight size={16} aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
