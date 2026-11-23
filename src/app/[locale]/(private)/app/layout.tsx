import { Link, redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUserClaims } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { PublicFooter } from "@/components/layout/public-footer";
import { Container } from "@/components/layout/container";
import { SignOut } from "@/features/auth/sign-out";
import { authMessages } from "@/features/auth/messages";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { getActiveHouseholdContext } from "@/features/household/data";
import { HouseholdHeaderSwitcher } from "@/features/household/household-header-switcher";
import { AppTelemetryTracker } from "@/components/telemetry/app-telemetry-tracker";
import { PilotFeedbackWidget } from "@/components/feedback/pilot-feedback-widget";
import { PushSubscriptionSync } from "@/components/pwa/push-subscription-sync";
import { IconUsers } from "@tabler/icons-react";
import "@/styles/tailwind-private.css";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const [locale, { user, error }, householdContext] = await Promise.all([
    getLocale(),
    getCurrentUserClaims(),
    getActiveHouseholdContext(),
  ]);
  if (!user || error) return redirect({ href: "/login", locale });
  const t = authMessages[locale];
  const pl = locale === "pl";

  const { activeHousehold, availableHouseholds } = householdContext;

  return (
    <div className="household-shell">
      <AppTelemetryTracker />
      <PushSubscriptionSync householdId={activeHousehold?.id ?? null} />
      <header className="household-header">
        <Container>
          <div className="household-brand">
            <BrandLogo href="/app" />
            <span>{dashboardMessages[locale].recordLabel}</span>
          </div>
          <p className="household-account">
            {t.signedIn}
            <strong>{user.email}</strong>
          </p>
          <div className="household-header-actions">
            <div className="household-header-nav">
              <HouseholdHeaderSwitcher
                availableHouseholds={availableHouseholds}
                activeHouseholdId={activeHousehold?.id ?? null}
                locale={locale}
              />
              <Link
                href="/app/household"
                className="household-nav-link"
                title={pl ? "Konta rodzinne i współdzielenie" : "Family accounts & sharing"}
              >
                <IconUsers size={18} aria-hidden="true" />
                <span>{pl ? "Gospodarstwo" : "Household"}</span>
              </Link>
            </div>
            <div className="household-header-utility">
              <LanguageSwitch />
              <SignOut />
            </div>
          </div>
        </Container>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter signedIn />
      <PilotFeedbackWidget />
    </div>
  );
}
