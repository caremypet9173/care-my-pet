import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Container } from "./container";
import { AccountLink } from "@/features/auth/account-link";

export function PublicFooter({ signedIn = false }: { signedIn?: boolean }) {
  const t = useTranslations("copy");
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-top">
          <BrandLogo href={signedIn ? "/app" : "/"} />
          <nav aria-label={t("footerNavigation")}>
            <Link href="/help">{t("help")}</Link>
            <Link href="/privacy">{t("privacy")}</Link>
            <Link href="/privacy#cookies">{t("cookieNoticeDetails")}</Link>
            <Link href="/terms">{t("terms")}</Link>
            {!signedIn && <AccountLink initialSignedIn={false} />}
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
