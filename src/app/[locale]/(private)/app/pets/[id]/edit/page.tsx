import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { getPet } from "@/features/pets/data";
import { getHouseholdDetails } from "@/features/household/data";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-key-controls";
import { PetForm } from "@/features/pets/pet-form";
import { PetArchiveSection } from "@/features/pets/pet-archive-controls";
import { PetArchivedBlockedCard } from "@/features/pets/pet-archived-notice";
import { petMessages } from "@/features/pets/messages";
import type { Locale } from "@/i18n/types";
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
      ? `${pl ? "Edycja profilu" : "Edit profile"}: ${pet.imie}`
      : pl
        ? "Edycja profilu pupila"
        : "Edit pet profile",
  };
}
export default async function EditPetPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = (await getLocale()) as Locale;
  const t = petMessages[locale];
  const pet = await getPet((await params).id);
  if (!pet) notFound();
  const details = await getHouseholdDetails(pet.gospodarstwo_id);
  const canManage = Boolean(details?.household?.can_manage);
  const hasRecoveryKey = Boolean(details?.household?.has_recovery_key);
  return (
    <Container width="demo" className="pets-page">
      <Link href={`/app/pets/${pet.id}`}>← {pet.imie}</Link>
      <h1>{t.edit}</h1>
      {pet.archived_at ? (
        <PetArchivedBlockedCard pet={pet} locale={locale} isOwner={canManage} />
      ) : !hasRecoveryKey && details?.household ? (
        <HouseholdRecoveryBanner
          householdId={details.household.id}
          householdName={details.household.nazwa}
          ownerEmail={details.owner?.email ?? ""}
          recoveryEmail={details.household.recovery_email}
          canManage={Boolean(details.household.is_owner)}
          hasRecoveryKey={hasRecoveryKey}
        />
      ) : (
        <>
          <PetForm pet={pet} />
          {canManage && <PetArchiveSection pet={pet} />}
        </>
      )}
    </Container>
  );
}
