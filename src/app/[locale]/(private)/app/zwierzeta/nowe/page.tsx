import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { PetForm } from "@/features/pets/pet-form";
import { petMessages } from "@/features/pets/messages";
import { petFormMessages } from "@/features/pets/form-messages";
import { isHouseholdOwner } from "@/features/household/data";
import "@/styles/pets.css";

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
