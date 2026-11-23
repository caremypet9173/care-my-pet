import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { VitalMeasurement } from "./types";

export async function listVitalMeasurements(
  petId: string,
  metricType?: "blood_pressure" | "glucose" | "temperature",
): Promise<VitalMeasurement[]> {
  const client = await createClient();
  if (!client) throw new Error("Supabase unavailable");

  let query = client
    .from("pet_vital_measurement")
    .select("*")
    .eq("pet_id", petId)
    .order("measured_on", { ascending: false })
    .order("measured_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (metricType) {
    query = query.eq("metric_type", metricType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load vital measurements: ${error.message}`);
  }

  return (data || []) as VitalMeasurement[];
}
