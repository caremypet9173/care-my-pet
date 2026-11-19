import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { PetForm } from "@/features/pets/pet-form";
import { petMessages } from "@/features/pets/messages";
import { petFormMessages } from "@/features/pets/form-messages";
import { getActiveHouseholdContext } from "@/features/household/data";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-key-controls";
import "@/styles/pets.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const pl = locale === "pl";
  return {
    title: pl ? "Poznajmy Twojego pupila" : "Add a new pet",
    description: pl
      ? "Rejestracja nowego pupila w domowej kartotece zdrowia Care My Pet."
      : "Register a new pet in the Care My Pet health record.",
  };
}

export default async function NewPetPage() {
  const locale = await getLocale();
  const { activeHousehold, canManage, hasRecoveryKey } =
    await getActiveHouseholdContext();
  if (!canManage) {
    return redirect({ href: "/app", locale });
  }

  const t = petMessages[locale];
  const d = petFormMessages[locale];
  return (
    <Container width="demo" className="pets-page pet-registration-page">
      <Link href="/app">← {t.back}</Link>
      <div className="pet-registration-heading">
        <span>{d.newProfile}</span>
        <h1>{d.title}</h1>
        <p>{d.intro}</p>
      </div>
      {!hasRecoveryKey && activeHousehold ? (
        <HouseholdRecoveryBanner
          householdId={activeHousehold.id}
          householdName={activeHousehold.nazwa}
          ownerEmail=""
          recoveryEmail={activeHousehold.recovery_email}
          canManage={canManage}
          hasRecoveryKey={hasRecoveryKey}
        />
      ) : (
        <PetForm householdId={activeHousehold?.id} />
      )}
    </Container>
  );
}
