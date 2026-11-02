import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient<
  Database = any,
  SchemaName extends string & keyof Omit<Database, "__InternalSupabase"> = "public" extends keyof Omit<Database, "__InternalSupabase">
    ? "public"
    : string & keyof Omit<Database, "__InternalSupabase">,
>() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  return createBrowserClient<Database, SchemaName>(config.url, config.key, {
    isSingleton: true,
  });
}
