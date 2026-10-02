import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("copy");
  return {
    title: t("signIn"),
    robots: { index: false, follow: false },
  };
}

export default function LoginPage() {
  const t = useTranslations("copy");
  return (
    <Container width="prose">
      <Card className="login-panel" padding="lg">
        <h1>
          {t("justALittleLongerWerePreparing")}{" "}
          <span className="whitespace-nowrap">Care My Pet.</span>
        </h1>
        <p>{t("wereCreatingAPlaceWhereYourPets")}</p>
        <ButtonLink href="/demo/luna">
          {t("exploreASamplePetRecord")}
        </ButtonLink>
      </Card>
    </Container>
  );
}
