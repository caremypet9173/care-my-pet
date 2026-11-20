import { getLocale } from "next-intl/server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Link } from "@/i18n/navigation";
import { authDesignMessages } from "@/features/auth/design-messages";
import "@/styles/auth.css";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = authDesignMessages[locale];
  return (
    <div className="auth-page">
      <header className="auth-header"><div><BrandLogo /><span>{t.tagline}</span></div><Link href="/">← {t.back}</Link></header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} Care My Pet</span><nav aria-label={locale === "pl" ? "Informacje prawne" : "Legal information"}><Link href="/privacy">{locale === "pl" ? "Prywatność" : "Privacy"}</Link><Link href="/terms">{locale === "pl" ? "Regulamin" : "Terms"}</Link></nav></footer>
    </div>
  );
}
