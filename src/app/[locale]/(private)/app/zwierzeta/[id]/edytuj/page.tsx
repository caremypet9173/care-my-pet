import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { getPet } from "@/features/pets/data";
import { isPetHouseholdOwner } from "@/features/household/data";
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
  const isOwner = await isPetHouseholdOwner(pet.gospodarstwo_id);
  return (
    <Container width="demo" className="pets-page">
      <Link href={`/app/zwierzeta/${pet.id}`}>← {pet.imie}</Link>
      <h1>{t.edit}</h1>
      {pet.archived_at ? (
        <PetArchivedBlockedCard pet={pet} locale={locale} isOwner={isOwner} />
      ) : (
        <>
          <PetForm pet={pet} />
          {isOwner && <PetArchiveSection pet={pet} />}
        </>
      )}
    </Container>
  );
}
