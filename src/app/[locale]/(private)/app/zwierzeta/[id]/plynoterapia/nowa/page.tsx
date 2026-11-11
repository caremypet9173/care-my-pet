import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { FluidFormPage } from "@/features/fluid-therapy/fluid-form-page";
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

  return <FluidFormPage pet={pet} therapy={null} />;
}
