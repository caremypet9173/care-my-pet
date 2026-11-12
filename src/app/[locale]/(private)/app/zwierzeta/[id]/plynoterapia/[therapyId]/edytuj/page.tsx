import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPet } from "@/features/pets/data";
import { getFluidTherapy } from "@/features/fluid-therapy/data";
import { FluidFormPage } from "@/features/fluid-therapy/fluid-form-page";
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

  const therapy = await getFluidTherapy(id, therapyId);
  if (!therapy) notFound();

  return <FluidFormPage pet={pet} therapy={therapy} />;
}
