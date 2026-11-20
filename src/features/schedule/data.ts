import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarReportSummary,
  HouseholdNotificationSettings,
  ScheduleItem,
} from "./types";

export async function listHouseholdReportsSummary(
  householdId?: string | null,
): Promise<CalendarReportSummary[]> {
  const client = await createClient();
  if (!client) return [];
  let query = client
    .from("wynik_badania")
    .select("id, pet_id:zwierze_id, title, test_date, laboratory, doctor")
    .order("test_date", { ascending: false })
    .order("confirmed_at", { ascending: false })
    .limit(400);
  if (householdId) {
    query = query.eq("gospodarstwo_id", householdId);
  }
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CalendarReportSummary[];
}

export async function listHouseholdScheduleItems(
  householdId?: string | null,
): Promise<ScheduleItem[]> {
  const client = await createClient();
  if (!client) return [];
  let query = client
    .from("pet_schedule_item")
    .select("*")
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (householdId) {
    query = query.eq("household_id", householdId);
  }
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ScheduleItem[];
}

export const listPetScheduleItems = cache(async (
  petId: string,
): Promise<ScheduleItem[]> => {
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
});

export const getHouseholdNotificationSettings = cache(async (
  householdId?: string | null,
): Promise<HouseholdNotificationSettings> => {
  const fallback: HouseholdNotificationSettings = {
    email_enabled: true,
    notify_7_days_before: true,
    notify_1_day_before: true,
    notify_day_of: false,
    custom_email: "",
  };
  const client = await createClient();
  if (!client) return fallback;
  let query = client
    .from("household_notification_settings")
    .select("*");
  if (householdId) {
    query = query.eq("household_id", householdId);
  }
  const { data, error } = await query
    .limit(1)
    .maybeSingle();
  if (error || !data) return fallback;
  return {
    id: data.id,
    household_id: data.household_id,
    email_enabled: Boolean(data.email_enabled),
    notify_7_days_before: Boolean(data.notify_7_days_before),
    notify_1_day_before: Boolean(data.notify_1_day_before),
    notify_day_of: Boolean(data.notify_day_of),
    custom_email: String(data.custom_email ?? ""),
  };
});
