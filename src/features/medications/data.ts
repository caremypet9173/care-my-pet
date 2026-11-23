import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MedicationLog, MedicationSchedule } from "./types";

const SCHEDULE_COLUMNS =
  "id,pet_id,household_id,name,dosage,schedule_type,interval_value,interval_unit,start_date,end_date,scheduled_time,scheduled_times,instructions,is_active,stock_quantity,low_stock_threshold,stock_unit,schedule_category,fluid_name,fluid_volume_ml,fluid_route,fluid_location,revision,created_by,created_at,updated_at";

const LOG_COLUMNS =
  "id,schedule_id,pet_id,household_id,dose_date,scheduled_time,administered_at,status,administered_by,notes,revision,created_by,created_at,updated_at";

export const listHouseholdMedicationSchedules = cache(
  async (householdId?: string | null): Promise<MedicationSchedule[]> => {
    const client = await createClient();
    if (!client) return [];
    let query = client
      .from("medication_schedules")
      .select(SCHEDULE_COLUMNS)
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    if (householdId) {
      query = query.eq("household_id", householdId);
    }

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return (data ?? []) as MedicationSchedule[];
  },
);

export const listPetMedicationSchedules = cache(
  async (petId: string): Promise<MedicationSchedule[]> => {
    const client = await createClient();
    if (!client) return [];
    const { data, error } = await client
      .from("medication_schedules")
      .select(SCHEDULE_COLUMNS)
      .eq("pet_id", petId)
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return [];
    }
    return (data ?? []) as MedicationSchedule[];
  },
);

export const listHouseholdMedicationLogs = cache(
  async (
    householdId?: string | null,
    limit = 500,
  ): Promise<MedicationLog[]> => {
    const client = await createClient();
    if (!client) return [];
    let query = client
      .from("medication_logs")
      .select(LOG_COLUMNS)
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
  },
);

export const listPetMedicationLogs = cache(
  async (petId: string, limit = 300): Promise<MedicationLog[]> => {
    const client = await createClient();
    if (!client) return [];
    const { data, error } = await client
      .from("medication_logs")
      .select(LOG_COLUMNS)
      .eq("pet_id", petId)
      .order("dose_date", { ascending: false })
      .order("administered_at", { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }
    return (data ?? []) as MedicationLog[];
  },
);
