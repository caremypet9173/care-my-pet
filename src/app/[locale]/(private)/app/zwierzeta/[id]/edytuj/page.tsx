import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { getPet } from "@/features/pets/data";
import { PetForm } from "@/features/pets/pet-form";
import { petMessages } from "@/features/pets/messages";
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
  const t = petMessages[await getLocale()];
  const pet = await getPet((await params).id);
  if (!pet) notFound();
  return <Container width="demo" className="pets-page"><Link href={`/app/zwierzeta/${pet.id}`}>← {pet.imie}</Link><h1>{t.edit}</h1><PetForm pet={pet} /></Container>;
}
