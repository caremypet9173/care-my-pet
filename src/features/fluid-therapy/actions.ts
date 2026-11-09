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
    return {
      error: error.message || "Błąd zapisu płynoterapii",
      isConflict,
    };
  }

  return { data: data as PetFluidTherapy };
}

export async function deleteFluidTherapy(params: {
  id: string;
  petId: string;
  revision: number;
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
    return {
      success: false,
      error: error.message || "Nie udało się usunąć wpisu płynoterapii",
      isConflict,
    };
  }

  return { success: true };
}
