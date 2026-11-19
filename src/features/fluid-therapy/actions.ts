import { createClient } from "@/lib/supabase/client";
import type { FluidLocation, FluidRoute, PetFluidTherapy } from "./types";

export interface SaveFluidTherapyParams {
  id?: string;
  petId: string;
  revision?: number;
  fluidName: string;
  volumeMl: number;
  route: FluidRoute;
  medicationsAdded?: string;
  location: FluidLocation;
  clinicName?: string;
  doctorName?: string;
  catheterStatus?: string;
  administeredAt?: string;
  administeredOn: string;
  notes?: string;
  locale?: "pl" | "en";
}

function resolveActionLocale(explicit?: "pl" | "en"): "pl" | "en" {
  if (explicit) return explicit;
  if (typeof document !== "undefined" && document.documentElement.lang === "en") {
    return "en";
  }
  return "pl";
}

export async function saveFluidTherapy(params: SaveFluidTherapyParams): Promise<{
  data?: PetFluidTherapy;
  error?: string;
  isConflict?: boolean;
}> {
  const client = createClient();
  const id = params.id || crypto.randomUUID();
  const revision = params.revision ?? 0;

  const { data, error } = await client.rpc("save_pet_fluid_therapy", {
    p_id: id,
    p_pet_id: params.petId,
    p_revision: revision,
    p_fluid_name: params.fluidName.trim(),
    p_volume_ml: params.volumeMl,
    p_route: params.route,
    p_medications_added: params.medicationsAdded?.trim() || "",
    p_location: params.location,
    p_clinic_name: params.clinicName?.trim() || "",
    p_doctor_name: params.doctorName?.trim() || "",
    p_catheter_status: params.catheterStatus?.trim() || "",
    p_administered_at: params.administeredAt || new Date().toISOString(),
    p_administered_on: params.administeredOn,
    p_notes: params.notes?.trim() || "",
  });

  if (error) {
    const isConflict = error.code === "PT409";
    const en = resolveActionLocale(params.locale) === "en";
    return {
      error:
        error.code === "PT428"
          ? en
            ? "This household requires a recovery key before making changes (read-only mode)."
            : "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu)."
          : error.message || (en ? "Failed to save fluid therapy" : "Błąd zapisu płynoterapii"),
      isConflict,
    };
  }

  return { data: data as PetFluidTherapy };
}

export async function deleteFluidTherapy(params: {
  id: string;
  petId: string;
  revision: number;
  locale?: "pl" | "en";
}): Promise<{
  success: boolean;
  error?: string;
  isConflict?: boolean;
}> {
  const client = createClient();
  const { error } = await client.rpc("delete_pet_fluid_therapy", {
    p_id: params.id,
    p_pet_id: params.petId,
    p_revision: params.revision,
  });

  if (error) {
    const isConflict = error.code === "PT409";
    const en = resolveActionLocale(params.locale) === "en";
    return {
      success: false,
      error:
        error.code === "PT428"
          ? en
            ? "This household requires a recovery key before making changes (read-only mode)."
            : "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu)."
          : error.message || (en ? "Failed to delete fluid therapy entry" : "Nie udało się usunąć wpisu płynoterapii"),
      isConflict,
    };
  }

  return { success: true };
}
