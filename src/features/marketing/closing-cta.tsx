import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { WaitlistCtaButton } from "@/features/waitlist/waitlist-cta-button";

export function ClosingCta() {
  const locale = useLocale();
  const pl = locale === "pl";
  const t = useTranslations("copy");
  return (
    <div className="closing-cta">
      <h2>{t("everythingThatMattersForYourPetTogether")}</h2>
      <p>{t("seeHowTestsVisitsAndRecommendationsCome")}</p>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.25rem" }}>
        <WaitlistCtaButton className="waitlist-submit-btn">
          {pl ? "Jestem zainteresowany" : "Join the waitlist"}
        </WaitlistCtaButton>
        <ButtonLink href="/demo/luna" variant="secondary">
          {t("exploreASamplePetRecord")}
        </ButtonLink>
      </div>
    </div>
  );
}
