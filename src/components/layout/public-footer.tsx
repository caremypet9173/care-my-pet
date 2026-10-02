import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "./container";

export function PublicFooter() {
  const t = useTranslations("copy");
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-top">
          <BrandLogo />
          <nav aria-label={t("footerNavigation")}>
            <Link href="/prywatnosc">{t("privacy")}</Link>
            <Link href="/regulamin">{t("terms")}</Link>
            <Link href="/login">{t("signIn100")}</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} {t("careMyPetAllRightsReserved")}
          </p>
          <p>{t("thisToolHelpsOrganiseYourOwnRecords")}</p>
        </div>
      </Container>
    </footer>
  );
}
