import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MedicationLog, MedicationSchedule } from "./types";

export async function listHouseholdMedicationSchedules(
  householdId?: string | null,
): Promise<MedicationSchedule[]> {
  const client = await createClient();
  if (!client) return [];
  let query = client
    .from("medication_schedules")
    .select("*")
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (householdId) {
    query = query.eq("household_id", householdId);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }
  return (data ?? []) as MedicationSchedule[];
}

export async function listPetMedicationSchedules(
  petId: string,
): Promise<MedicationSchedule[]> {
  const client = await createClient();
  if (!client) return [];
  const { data, error } = await client
    .from("medication_schedules")
    .select("*")
    .eq("pet_id", petId)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }
  return (data ?? []) as MedicationSchedule[];
}

export async function listHouseholdMedicationLogs(
  householdId?: string | null,
  limit = 500,
): Promise<MedicationLog[]> {
  const client = await createClient();
  if (!client) return [];
  let query = client
    .from("medication_logs")
    .select("*")
    .order("dose_date", { ascending: false })
    .order("administered_at", { ascending: false })
    .limit(limit);

  if (householdId) {
    query = query.eq("household_id", householdId);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }
  return (data ?? []) as MedicationLog[];
}

export async function listPetMedicationLogs(
  petId: string,
  limit = 300,
): Promise<MedicationLog[]> {
  const client = await createClient();
  if (!client) return [];
  const { data, error } = await client
    .from("medication_logs")
    .select("*")
    .eq("pet_id", petId)
    .order("dose_date", { ascending: false })
    .order("administered_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }
  return (data ?? []) as MedicationLog[];
}
