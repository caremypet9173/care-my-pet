import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { PetArchivedBlockedCard } from "@/features/pets/pet-archived-notice";
import { ReviewForm } from "@/features/medical/review-form";
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
  if (pet.archived_at) {
    const locale = (await getLocale()) as Locale;
    return (
      <main className="pets-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem" }}>
        <PetArchivedBlockedCard pet={pet} locale={locale} />
      </main>
    );
  }
  return <ReviewForm pet={pet}/>;
}
