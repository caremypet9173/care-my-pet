import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { listPets } from "@/features/pets/data";
import { listHouseholdHealthEvents } from "@/features/history/data";
import {
  getHouseholdNotificationSettings,
  listHouseholdReportsSummary,
  listHouseholdScheduleItems,
} from "@/features/schedule/data";
import { getActiveHouseholdContext } from "@/features/household/data";
import { petMessages } from "@/features/pets/messages";
import { HouseholdDashboard } from "@/features/pets/household-dashboard";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { IconPlus, IconUpload, IconUsers } from "@tabler/icons-react";
import "@/styles/pets.css";
import "@/styles/weight.css";
import "@/styles/medical.css";

export default async function AppPage() {
  const locale = await getLocale();
  const t = petMessages[locale];
  const { activeHousehold, isOwner } = await getActiveHouseholdContext();
  const householdId = activeHousehold?.id ?? null;

  const [pets, healthEvents, scheduleItems, notificationSettings, reportsSummary] =
    await Promise.all([
      listPets(householdId),
      listHouseholdHealthEvents(householdId),
      listHouseholdScheduleItems(householdId),
      getHouseholdNotificationSettings(householdId),
      listHouseholdReportsSummary(householdId),
    ]);
  const d = dashboardMessages[locale];
  const empty = pets?.length === 0;
  const firstPet = locale === "pl" ? "Dodaj pierwszego pupila" : "Add your first pet";
  const primaryPet = pets && pets.length > 0 ? pets[0] : null;

  return (
    <Container className="pets-page">
      <div className="pets-heading">
        <div>
          <div className="pets-eyebrows-row">
            <span className="pets-eyebrow">{d.dashboard}</span>
            {!isOwner && (
              <span className="household-co-guardian-pill">
                <IconUsers size={13} aria-hidden="true" />
                {locale === "pl"
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
          {isOwner && (
            <ButtonLink
              variant={empty ? "primary" : "secondary"}
              size="sm"
              href="/app/zwierzeta/nowe"
            >
              <IconPlus size={16} aria-hidden="true" />
              {empty ? firstPet : t.add}
            </ButtonLink>
          )}
          {primaryPet && (
            <ButtonLink
              variant="secondary"
              size="sm"
              href={`/app/zwierzeta/${primaryPet.id}/badania/nowe`}
            >
              <IconUpload size={16} aria-hidden="true" />
              {d.upload}
            </ButtonLink>
          )}
          <ButtonLink variant="secondary" size="sm" href="/app/gospodarstwo">
            <IconUsers size={16} aria-hidden="true" />
            {locale === "pl" ? "Gospodarstwo" : "Household"}
          </ButtonLink>
        </div>
      </div>
      {!isOwner && activeHousehold && (
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
                ? "Działasz w trybie współdzielonym. Masz pełny wgląd w zdrowie i dokumentację pupili oraz wspólny terminarz. Dodawanie nowych zwierząt oraz zarządzanie członkami wykonuje właściciel gospodarstwa."
                : "You are acting in shared mode. You have full access to health records and shared calendar. Adding new pets and managing members is handled by the household owner."}
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
          notificationSettings={notificationSettings}
          locale={locale}
          canAddPet={isOwner}
        />
      )}
    </Container>
  );
}
