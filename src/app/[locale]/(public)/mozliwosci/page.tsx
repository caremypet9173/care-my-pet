import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Translator } from "@/i18n/types";
import type { Metadata } from "next";
import {
  IconCalendarEvent,
  IconFileDescription,
  IconPaw,
  IconUsers,
} from "@tabler/icons-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Card } from "@/components/ui/card";
import { ClosingCta } from "@/features/marketing/closing-cta";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return { title: t("features") };
}
function getFeatures(t: Translator) {
  return [
    {
      id: "kartoteka",
      icon: IconPaw,
      title: t("everyPetHasAStory"),
      text: t("theirProfileWeightNotesAndVisitHistory"),
    },
    {
      id: "dokumenty",
      icon: IconFileDescription,
      title: t("theDocumentBesideTheResult"),
      text: t("aParameterOverviewHelpsYouFindA"),
    },
    {
      id: "terminy",
      icon: IconCalendarEvent,
      title: t("importantDatesWithinReach"),
      text: t("theNextCheckUpAndRecommendationsFrom"),
    },
    {
      id: "wspolna-opieka",
      icon: IconUsers,
      title: t("careThatsEasierToShare"),
      text: t("invitedFamilyMembersWillEventuallyBeAble"),
    },
  ];
}

export default function FeaturesPage() {
  const t = useTranslations("copy");
  return (
    <Section>
      <Container>
        <div className="page-heading">
          <span className="eyebrow accent-text">{t("connectionAndCare")}</span>
          <h1>{t("lessSearchingMorePeaceOfMind")}</h1>
          <p>{t("discoverAWayToOrganiseEverydayCare")}</p>
        </div>
        <div className="feature-detail-grid">
          {getFeatures(t).map(({ id, icon: Icon, title, text }) => (
            <Card key={id} id={id} padding="lg">
              <span className="icon-tile">
                <Icon aria-hidden="true" />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </Card>
          ))}
        </div>
        <ClosingCta />
      </Container>
    </Section>
  );
}
