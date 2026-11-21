import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet, listPetSwitcherPets } from "@/features/pets/data";
import { getHouseholdDetails } from "@/features/household/data";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-banner";
import { PetArchivedBlockedCard } from "@/features/pets/pet-archived-notice";
import { ReviewForm } from "@/features/medical/review-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import "@/styles/medical.css";
import "@/styles/pets.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const pet = await getPet(id);
  const pl = locale === "pl";

  return {
    title: pet
      ? `${pl ? "Nowe badanie dla" : "New lab report for"}: ${pet.imie}`
      : pl
        ? "Nowe badanie laboratoryjne"
        : "New lab report",
  };
}
export default async function NewReportPage({params}:{params:Promise<{id:string}>}) {
  const pet=await getPet((await params).id);if(!pet)notFound();
  const locale = (await getLocale()) as Locale;
  if (pet.archived_at) {
    return (
      <div className="pets-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <PetArchivedBlockedCard pet={pet} locale={locale} />
      </div>
    );
  }
  const [details, switcherPets] = await Promise.all([
    getHouseholdDetails(pet.gospodarstwo_id),
    listPetSwitcherPets(pet.gospodarstwo_id),
  ]);
  const hasRecoveryKey = Boolean(details?.household?.has_recovery_key);
  if (!hasRecoveryKey && details?.household) {
    return (
      <div className="pets-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <Link href={`/app/pets/${pet.id}`}>← {pet.imie}</Link>
        <HouseholdRecoveryBanner
          householdId={details.household.id}
          householdName={details.household.nazwa}
          ownerEmail={details.owner?.email ?? ""}
          recoveryEmail={details.household.recovery_email}
          canManage={Boolean(details.household.is_owner)}
          hasRecoveryKey={hasRecoveryKey}
        />
      </div>
    );
  }
  const otherPets = switcherPets
    .filter((p) => p.id !== pet.id)
    .map((p) => ({ id: p.id, imie: p.imie }));
  return <ReviewForm pet={pet} otherPets={otherPets} />;
}
