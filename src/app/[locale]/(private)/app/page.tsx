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
  const [pets, healthEvents, scheduleItems, notificationSettings, reportsSummary] =
    await Promise.all([
      listPets(),
      listHouseholdHealthEvents(),
      listHouseholdScheduleItems(),
      getHouseholdNotificationSettings(),
      listHouseholdReportsSummary(),
    ]);
  const d = dashboardMessages[locale];
  const empty = pets?.length === 0;
  const firstPet = locale === "pl" ? "Dodaj pierwszego pupila" : "Add your first pet";
  const primaryPet = pets && pets.length > 0 ? pets[0] : null;
  return <Container className="pets-page">
    <div className="pets-heading"><div><span className="pets-eyebrow">{d.dashboard}</span><h1>{t.title}</h1><p>{t.intro}</p></div><div className="household-heading-actions"><ButtonLink variant={empty ? "primary" : "secondary"} size="sm" href="/app/zwierzeta/nowe"><IconPlus size={16} aria-hidden="true" />{empty ? firstPet : t.add}</ButtonLink>{primaryPet && <ButtonLink variant="secondary" size="sm" href={`/app/zwierzeta/${primaryPet.id}/badania/nowe`}><IconUpload size={16} aria-hidden="true" />{d.upload}</ButtonLink>}<ButtonLink variant="secondary" size="sm" href="/app/gospodarstwo"><IconUsers size={16} aria-hidden="true" />{locale === "pl" ? "Współopiekunowie" : "Co-guardians"}</ButtonLink></div></div>
    {pets === null ? <p role="alert">{t.loadFailed}</p> : <HouseholdDashboard pets={pets} healthEvents={healthEvents} scheduleItems={scheduleItems} reportsSummary={reportsSummary} notificationSettings={notificationSettings} locale={locale} />}
  </Container>;
}
