import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";

export function ClosingCta() {
  const t = useTranslations("copy");
  return (
    <div className="closing-cta">
      <h2>{t("everythingThatMattersForYourPetTogether")}</h2>
      <p>{t("seeHowTestsVisitsAndRecommendationsCome")}</p>
      <ButtonLink href="/demo/luna" variant="accent">
        {t("exploreASamplePetRecord")}
      </ButtonLink>
    </div>
  );
}
