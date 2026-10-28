import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { getHouseholdDetails } from "@/features/household/data";
import { HouseholdManager } from "@/features/household/household-manager";
import { IconArrowLeft } from "@tabler/icons-react";
import "@/styles/pets.css";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const locale = await getLocale();
  const pl = locale === "pl";
  const data = await getHouseholdDetails();

  if (!data) {
    return redirect({ href: "/app", locale });
  }

  return (
    <Container className="pets-page">
      <div className="pets-heading">
        <div>
          <span className="pets-eyebrow">
            {pl ? "Współdzielenie i rodzina" : "Sharing & family"}
          </span>
          <h1>{data.household.nazwa || (pl ? "Gospodarstwo domowe" : "Household")}</h1>
          <p>
            {pl
              ? "Zarządzaj współopiekunami, rolami oraz zaproszeniami do wspólnej opieki nad pupilami."
              : "Manage co-guardians, roles, and invitations for collaborative pet care."}
          </p>
        </div>
        <div className="household-heading-actions">
          <ButtonLink variant="secondary" size="sm" href="/app">
            <IconArrowLeft size={16} aria-hidden="true" />
            {pl ? "Powrót do pupili" : "Back to pets"}
          </ButtonLink>
        </div>
      </div>

      <HouseholdManager initialData={data} />
    </Container>
  );
}
