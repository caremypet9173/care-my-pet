import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ScheduleItem } from "./types";

export async function listHouseholdScheduleItems(): Promise<ScheduleItem[]> {
  const client = await createClient();
  if (!client) return [];
  const { data, error } = await client
    .from("pet_schedule_item")
    .select("*")
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return [];
  return (data ?? []) as ScheduleItem[];
}

export async function listPetScheduleItems(
  petId: string,
): Promise<ScheduleItem[]> {
  const client = await createClient();
  if (!client) return [];
  const { data, error } = await client
    .from("pet_schedule_item")
    .select("*")
    .eq("pet_id", petId)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []) as ScheduleItem[];
}
