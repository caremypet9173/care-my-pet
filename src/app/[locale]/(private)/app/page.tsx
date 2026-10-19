import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { listPets } from "@/features/pets/data";
import { petMessages } from "@/features/pets/messages";
import { HouseholdDashboard } from "@/features/pets/household-dashboard";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { IconPlus, IconUpload } from "@tabler/icons-react";
import "@/styles/pets.css";

export default async function AppPage() {
  const locale = await getLocale();
  const t = petMessages[locale];
  const pets = await listPets();
  const d = dashboardMessages[locale];
  const empty = pets?.length === 0;
  const firstPet = locale === "pl" ? "Dodaj pierwszego pupila" : "Add your first pet";
  return <Container className="pets-page">
    <div className="pets-heading"><div><span className="pets-eyebrow">{d.dashboard}</span><h1>{t.title}</h1><p>{t.intro}</p></div><div className="household-heading-actions"><ButtonLink variant={empty ? "primary" : "secondary"} size="sm" href="/app/zwierzeta/nowe"><IconPlus size={16} aria-hidden="true" />{empty ? firstPet : t.add}</ButtonLink><div><Button size="sm" disabled><IconUpload size={16} aria-hidden="true" />{d.upload}</Button><small>{d.upcoming}</small></div></div></div>
    {pets === null ? <p role="alert">{t.loadFailed}</p> : <HouseholdDashboard pets={pets} locale={locale} />}
  </Container>;
}
