import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export default function NotFound() {
  const t = useTranslations("copy");
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container width="prose">
            <div className="page-heading">
              <h1>{t("thisPageIsntHere")}</h1>
              <p>{t("goBackHomeOrExploreLunasSample")}</p>
              <ButtonLink href="/">{t("backToHome")}</ButtonLink>
            </div>
          </Container>
        </Section>
      </main>
      <PublicFooter />
    </>
  );
}
