import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { PetArchivedBlockedCard } from "@/features/pets/pet-archived-notice";
import { FluidFormPage } from "@/features/fluid-therapy/fluid-form-page";
import type { Locale } from "@/i18n/types";
import "@/styles/pets.css";
import "@/styles/fluid-form.css";

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
      ? `${pl ? "Nowa płynoterapia / kroplówka dla" : "New fluid therapy for"}: ${pet.imie}`
      : pl
        ? "Nowa płynoterapia / kroplówka"
        : "New fluid therapy",
  };
}

export default async function NewFluidTherapyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pet = await getPet(id);
  if (!pet) notFound();
  if (pet.archived_at) {
    const locale = (await getLocale()) as Locale;
    return (
      <main className="pets-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <PetArchivedBlockedCard pet={pet} locale={locale} />
      </main>
    );
  }

  return <FluidFormPage pet={pet} therapy={null} />;
}
