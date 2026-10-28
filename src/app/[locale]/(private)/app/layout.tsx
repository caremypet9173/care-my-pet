import { Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { PublicFooter } from "@/components/layout/public-footer";
import { Container } from "@/components/layout/container";
import { SignOut } from "@/features/auth/sign-out";
import { authMessages } from "@/features/auth/messages";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { getActiveHouseholdContext } from "@/features/household/data";
import { HouseholdHeaderSwitcher } from "@/features/household/household-header-switcher";
import { IconUsers } from "@tabler/icons-react";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const result = supabase ? await supabase.auth.getUser() : null;
  if (!result?.data.user || result.error) return redirect({ href: "/login", locale });
  const t = authMessages[locale];
  const pl = locale === "pl";

  const { activeHousehold, availableHouseholds } = await getActiveHouseholdContext();

  return (
    <div className="household-shell">
      <header className="household-header">
        <Container>
          <div className="household-brand">
            <BrandLogo />
            <span>{dashboardMessages[locale].recordLabel}</span>
          </div>
          <p className="household-account">
            {t.signedIn}
            <strong>{result.data.user.email}</strong>
          </p>
          <div className="household-header-actions">
            <HouseholdHeaderSwitcher
              availableHouseholds={availableHouseholds}
              activeHouseholdId={activeHousehold?.id ?? null}
              locale={locale}
            />
            <Link
              href="/app/gospodarstwo"
              className="household-nav-link"
              title={pl ? "Konta rodzinne i współdzielenie" : "Family accounts & sharing"}
            >
              <IconUsers size={18} aria-hidden="true" />
              <span>{pl ? "Gospodarstwo" : "Household"}</span>
            </Link>
            <LanguageSwitch />
            <SignOut />
          </div>
        </Container>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter signedIn />
    </div>
  );
}
