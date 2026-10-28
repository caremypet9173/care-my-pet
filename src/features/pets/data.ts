import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Pet } from "./types";
async function withAvatars(client: NonNullable<Awaited<ReturnType<typeof createClient>>>, pets: Pet[]) {
  const paths = pets.flatMap(pet => pet.avatar_path ? [pet.avatar_path] : []);
  if (!paths.length) return pets;
  const { data } = await client.storage.from("pet-avatars").createSignedUrls(paths, 3600);
  const urls = new Map(data?.map(item => [item.path, item.signedUrl]));
  return pets.map(pet => ({ ...pet, avatar_url: pet.avatar_path ? urls.get(pet.avatar_path) ?? null : null }));
}
export async function listPets(): Promise<Pet[] | null> {
  const client = await createClient();
  if (!client) return null;
  const { data, error } = await client.from("zwierze").select("*,medical_reports:wynik_badania(count)").order("created_at");
  if(error)return null;
  const pets=(data as (Pet & {medical_reports:{count:number}[]})[]).map(({medical_reports,...pet})=>({...pet,report_count:medical_reports[0]?.count??0}));
  return withAvatars(client,pets);
}
export async function getPet(id: string): Promise<Pet | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const client = await createClient();
  if (!client) throw new Error("Supabase unavailable");
  const { data, error } = await client.from("zwierze").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[getPet error]", error);
    throw new Error(`Could not load pet: ${error.message} (${error.code})`);
  }
  return data ? (await withAvatars(client, [data as Pet]))[0] : null;
}
