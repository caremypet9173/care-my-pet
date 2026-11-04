import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { PetForm } from "@/features/pets/pet-form";
import { petMessages } from "@/features/pets/messages";
import { petFormMessages } from "@/features/pets/form-messages";
import { isHouseholdOwner } from "@/features/household/data";
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
  const isOwner = await isHouseholdOwner();
  if (!isOwner) {
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
      <PetForm />
    </Container>
  );
}
