import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { getActiveHouseholdId } from "@/features/household/data";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-banner";
import { getHouseholdDashboardBundle } from "@/features/pets/dashboard-bundle";
import { petMessages } from "@/features/pets/messages";
import { HouseholdDashboard } from "@/features/pets/household-dashboard";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { IconPlus, IconUpload, IconUsers } from "@tabler/icons-react";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const pl = locale === "pl";
  return {
    title: pl ? "Pulpit opieki" : "Pet care dashboard",
    description: pl
      ? "Podsumowanie zdrowia, terminarz wizyt, aktywne leki i kartoteki Twoich pupili."
      : "Health summary, visit schedule, active medications, and records for your pets.",
  };
}

export default async function AppPage() {
  const [locale, cookieHouseholdId] = await Promise.all([
    getLocale(),
    getActiveHouseholdId(),
  ]);
  const t = petMessages[locale];
  const {
    activeHousehold,
    isOwner,
    canManage,
    hasRecoveryKey,
    ownerEmail,
    pets,
    healthEvents,
    scheduleItems,
    notificationSettings,
    reportsSummary,
    medicationSchedules,
    medicationLogs,
  } = await getHouseholdDashboardBundle(cookieHouseholdId);
  const d = dashboardMessages[locale];
  const activePets = (pets ?? []).filter((pet) => !pet.archived_at);
  const empty = pets?.length === 0;
  const firstPet = locale === "pl" ? "Dodaj pierwszego pupila" : "Add your first pet";
  const primaryPet = activePets.length > 0 ? activePets[0] : null;

  return (
    <Container className="pets-page">
      <div className="pets-heading">
        <div>
          <div className="pets-eyebrows-row">
            <span className="pets-eyebrow">{d.dashboard}</span>
            {!isOwner && activeHousehold && (
              <span className="household-co-guardian-pill">
                <IconUsers size={13} aria-hidden="true" />
                {canManage
                  ? locale === "pl"
                    ? "Gospodarstwo współdzielone (Współadministrator)"
                    : "Shared household (Co-admin)"
                  : locale === "pl"
                    ? "Gospodarstwo współdzielone (Współopiekun)"
                    : "Shared household (Co-guardian)"}
              </span>
            )}
          </div>
          <h1>
            {activeHousehold?.nazwa
              ? `${t.title} – ${activeHousehold.nazwa}`
              : t.title}
          </h1>
          <p>{t.intro}</p>
        </div>
        <div className="household-heading-actions">
          {canManage && hasRecoveryKey && (
            <ButtonLink
              variant={empty ? "primary" : "secondary"}
              size="sm"
              href="/app/pets/new"
            >
              <IconPlus size={16} aria-hidden="true" />
              {empty ? firstPet : t.add}
            </ButtonLink>
          )}
          {primaryPet && hasRecoveryKey && (
            <ButtonLink
              variant="secondary"
              size="sm"
              href={`/app/pets/${primaryPet.id}/results/new`}
            >
              <IconUpload size={16} aria-hidden="true" />
              {d.upload}
            </ButtonLink>
          )}
          <ButtonLink variant="secondary" size="sm" href="/app/household">
            <IconUsers size={16} aria-hidden="true" />
            {locale === "pl" ? "Gospodarstwo" : "Household"}
          </ButtonLink>
        </div>
      </div>
      {activeHousehold && !hasRecoveryKey && (
        <HouseholdRecoveryBanner
          householdId={activeHousehold.id}
          householdName={activeHousehold.nazwa}
          ownerEmail={ownerEmail}
          recoveryEmail={activeHousehold.recovery_email}
          canManage={isOwner}
          hasRecoveryKey={hasRecoveryKey}
        />
      )}
      {!canManage && activeHousehold && (
        <div className="household-co-guardian-banner">
          <div className="household-co-guardian-banner-icon" aria-hidden="true">
            <IconUsers size={22} />
          </div>
          <div className="household-co-guardian-banner-content">
            <strong>
              {locale === "pl"
                ? `Jesteś współopiekunem w gospodarstwie „${activeHousehold.nazwa}”`
                : `You are a co-guardian in "${activeHousehold.nazwa}"`}
            </strong>
            <p>
              {locale === "pl"
                ? "Działasz w trybie współdzielonym. Masz pełny wgląd w zdrowie i dokumentację pupili oraz wspólny terminarz. Dodawanie nowych zwierząt oraz zarządzanie członkami wykonuje właściciel lub współadministrator gospodarstwa."
                : "You are acting in shared mode. You have full access to health records and shared calendar. Adding new pets and managing members is handled by the household owner or co-admin."}
            </p>
          </div>
        </div>
      )}
      {pets === null ? (
        <p role="alert">{t.loadFailed}</p>
      ) : (
        <HouseholdDashboard
          pets={pets}
          healthEvents={healthEvents}
          scheduleItems={scheduleItems}
          reportsSummary={reportsSummary}
          medicationSchedules={medicationSchedules}
          medicationLogs={medicationLogs}
          notificationSettings={notificationSettings}
          locale={locale}
          canAddPet={canManage && hasRecoveryKey}
          readOnly={!hasRecoveryKey}
        />
      )}
    </Container>
  );
}
