import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCloudCheck,
  IconFileDescription,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { assets } from "@/lib/assets";

export function Hero() {
  const t = useTranslations("copy");
  return (
    <Section spacing="hero" aria-labelledby="hero-title">
      <Container className="hero-grid">
        <div className="hero-copy">
          <Badge dot className="eyebrow">
            {t("peacefulCareAtHome")}
          </Badge>
          <h1 id="hero-title">
            {t("moreMomentsTogetherLessSearchingForResults")}
          </h1>
          <p className="hero-lead">{t("yourDogOrCatsTestsVisitsAnd214")}</p>
          <div className="hero-actions">
            <ButtonLink href="/demo/luna" variant="accent">
              {t("exploreASamplePetRecord")}{" "}
              <IconArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
            <span className="caption">{t("noSignInNeededFictionalData")}</span>
          </div>
          <div className="hero-trust">
            <span>
              <IconShieldCheck size={17} aria-hidden="true" />
              {t("dataPrivacy")}
            </span>
            <span>
              <IconCloudCheck size={17} aria-hidden="true" />
              {t("withinReachOnYourPhone")}
            </span>
          </div>
        </div>
        <div className="hero-photo">
          <Image
            src={assets.pets}
            alt={t("aDogAndCatCuddledUpAsleep")}
            fill
            sizes="(min-width: 1280px) 580px, (min-width: 1024px) 48vw, 100vw"
            preload
          />
          <div className="hero-overlay" />
          <div className="photo-note photo-note--top">
            <span className="icon-tile icon-tile--mint">
              <IconFileDescription size={23} aria-hidden="true" />
            </span>
            <div>
              <span className="caption success-text">
                {t("resultsWithinReach")}
              </span>
              <strong>{t("bloodTestsPdf")}</strong>
            </div>
          </div>
          <div className="photo-note photo-note--bottom">
            <span className="icon-tile">
              <IconCalendarEvent size={23} aria-hidden="true" />
            </span>
            <div>
              <span className="caption accent-text">{t("sampleData")}</span>
              <strong>{t("nextVisit12October")}</strong>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
