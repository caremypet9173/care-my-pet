import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { getHouseholdDetails } from "@/features/household/data";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-key-controls";
import { PetArchivedBlockedCard } from "@/features/pets/pet-archived-notice";
import { getFluidTherapy } from "@/features/fluid-therapy/data";
import { FluidFormPage } from "@/features/fluid-therapy/fluid-form-page";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import "@/styles/pets.css";
import "@/styles/fluid-form.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; therapyId: string }>;
}): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const pet = await getPet(id);
  const pl = locale === "pl";

  return {
    title: pet
      ? `${pl ? "Edycja płynoterapii dla" : "Edit fluid therapy for"}: ${pet.imie}`
      : pl
        ? "Edycja płynoterapii"
        : "Edit fluid therapy",
  };
}

export default async function EditFluidTherapyPage({
  params,
}: {
  params: Promise<{ id: string; therapyId: string }>;
}) {
  const { id, therapyId } = await params;
  const pet = await getPet(id);
  if (!pet) notFound();
  const locale = (await getLocale()) as Locale;
  if (pet.archived_at) {
    return (
      <div className="pets-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <PetArchivedBlockedCard pet={pet} locale={locale} />
      </div>
    );
  }
  const details = await getHouseholdDetails(pet.gospodarstwo_id);
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

  const therapy = await getFluidTherapy(id, therapyId);
  if (!therapy) notFound();

  return <FluidFormPage pet={pet} therapy={therapy} />;
}
