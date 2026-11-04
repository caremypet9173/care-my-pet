import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { ReviewForm } from "@/features/medical/review-form";
import "@/styles/medical.css";

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
  return <ReviewForm pet={pet}/>;
}
