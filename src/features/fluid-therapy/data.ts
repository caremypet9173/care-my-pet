import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PetFluidTherapy } from "./types";

export async function listFluidTherapies(petId: string): Promise<PetFluidTherapy[]> {
  const client = await createClient();
  if (!client) throw new Error("Supabase unavailable");

  const { data, error } = await client
    .from("pet_fluid_therapy")
    .select("*")
    .eq("pet_id", petId)
    .order("administered_on", { ascending: false })
    .order("administered_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Could not load fluid therapies: ${error.message}`);
  }

  return (data || []) as PetFluidTherapy[];
}

export async function getFluidTherapy(
  petId: string,
  therapyId: string
): Promise<PetFluidTherapy | null> {
  const client = await createClient();
  if (!client) throw new Error("Supabase unavailable");

  const { data, error } = await client
    .from("pet_fluid_therapy")
    .select("*")
    .eq("id", therapyId)
    .eq("pet_id", petId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load fluid therapy: ${error.message}`);
  }

  return (data || null) as PetFluidTherapy | null;
}
