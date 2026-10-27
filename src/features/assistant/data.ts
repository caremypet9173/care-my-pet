import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssistantMessage, AssistantThread } from "./types";

export async function listAssistantThreads(
  petId: string,
): Promise<AssistantThread[]> {
  const client = await createClient();
  if (!client) throw Error("Supabase unavailable");

  const { data, error } = await client
    .from("pet_assistant_thread")
    .select("*")
    .eq("pet_id", petId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []) as AssistantThread[];
}

export async function listAssistantMessages(
  petId: string,
): Promise<AssistantMessage[]> {
  const client = await createClient();
  if (!client) throw Error("Supabase unavailable");

  const { data, error } = await client
    .from("pet_assistant_message")
    .select("*")
    .eq("pet_id", petId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...row,
    sources: Array.isArray(row.sources) ? row.sources : [],
    follow_ups: Array.isArray(row.follow_ups) ? row.follow_ups : [],
  })) as AssistantMessage[];
}

export async function getAssistantQuotaUsed(): Promise<number> {
  const client = await createClient();
  if (!client) return 0;
  const { data } = await client.rpc("get_ai_assistant_quota_used");
  return typeof data === "number" ? data : 0;
}
