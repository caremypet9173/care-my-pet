import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Pet } from "./types";

const AVATAR_SIGN_TTL_SECONDS = 3600;
const AVATAR_CACHE_TTL_MS = 25 * 60 * 1000;
const AVATAR_CACHE_MAX_ENTRIES = 500;

const signedAvatarCache = new Map<string, { url: string; expiresAt: number }>();
const petHouseholdIdCache = new Map<string, string>();

export function getCachedPetHouseholdId(petId: string): string | null {
  return petHouseholdIdCache.get(petId) ?? null;
}

export function rememberPetHouseholdId(petId: string, householdId: string | null | undefined) {
  if (!petId || !householdId) return;
  if (petHouseholdIdCache.size >= AVATAR_CACHE_MAX_ENTRIES) {
    const oldestKey = petHouseholdIdCache.keys().next().value;
    if (oldestKey) petHouseholdIdCache.delete(oldestKey);
  }
  petHouseholdIdCache.set(petId, householdId);
}

function getCachedSignedAvatarUrl(path: string, now: number): string | null {
  const hit = signedAvatarCache.get(path);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    signedAvatarCache.delete(path);
    return null;
  }
  return hit.url;
}

function setCachedSignedAvatarUrl(path: string, url: string, now: number) {
  if (signedAvatarCache.size >= AVATAR_CACHE_MAX_ENTRIES) {
    const oldestKey = signedAvatarCache.keys().next().value;
    if (oldestKey) signedAvatarCache.delete(oldestKey);
  }
  signedAvatarCache.set(path, { url, expiresAt: now + AVATAR_CACHE_TTL_MS });
}

export async function withAvatars<T extends { avatar_path?: string | null; avatar_url?: string | null }>(
  client: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  pets: T[],
): Promise<T[]> {
  const uniquePaths = Array.from(
    new Set(pets.flatMap((pet) => (pet.avatar_path ? [pet.avatar_path] : []))),
  );
  if (!uniquePaths.length) return pets;

  const now = Date.now();
  const urls = new Map<string, string>();
  const missingPaths: string[] = [];

  for (const path of uniquePaths) {
    const cached = getCachedSignedAvatarUrl(path, now);
    if (cached) {
      urls.set(path, cached);
    } else {
      missingPaths.push(path);
    }
  }

  if (missingPaths.length > 0) {
    const { data } = await client.storage
      .from("pet-avatars")
      .createSignedUrls(missingPaths, AVATAR_SIGN_TTL_SECONDS);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        urls.set(item.path, item.signedUrl);
        setCachedSignedAvatarUrl(item.path, item.signedUrl, now);
      }
    }
  }

  return pets.map((pet) => ({
    ...pet,
    avatar_url: pet.avatar_path ? urls.get(pet.avatar_path) ?? null : null,
  }));
}

export const listPets = cache(async (householdId?: string | null): Promise<Pet[] | null> => {
  const client = await createClient();
  if (!client) return null;
  let query = client
    .from("zwierze")
    .select("*,medical_reports:wynik_badania(count)")
    .is("medical_reports.deleted_at", null)
    .order("created_at");
  if (householdId) {
    query = query.eq("gospodarstwo_id", householdId);
  }
  const { data, error } = await query;
  if (error) return null;
  const pets = (data as (Pet & { medical_reports: { count: number }[] })[]).map(
    ({ medical_reports, ...pet }) => {
      rememberPetHouseholdId(pet.id, pet.gospodarstwo_id);
      return {
        ...pet,
        report_count: medical_reports[0]?.count ?? 0,
      };
    },
  );
  return withAvatars(client, pets);
});

export const listPetSwitcherPets = cache(
  async (
    householdId: string,
  ): Promise<Pick<Pet, "id" | "imie" | "gatunek" | "avatar_url" | "tagi">[]> => {
    const client = await createClient();
    if (!client) return [];
    const { data, error } = await client
      .from("zwierze")
      .select("id, imie, gatunek, avatar_path, tagi")
      .eq("gospodarstwo_id", householdId)
      .is("archived_at", null)
      .order("created_at")
      .limit(50);

    if (error || !data) return [];
    const signed = await withAvatars(
      client,
      data as Array<{
        id: string;
        imie: string;
        gatunek: Pet["gatunek"];
        avatar_path: string | null;
        avatar_url?: string | null;
        tagi: string[];
      }>,
    );
    return signed.map(({ id, imie, gatunek, avatar_url, tagi }) => {
      rememberPetHouseholdId(id, householdId);
      return {
        id,
        imie,
        gatunek,
        avatar_url: avatar_url ?? null,
        tagi: Array.isArray(tagi) ? tagi : [],
      };
    });
  },
);

export const getPet = cache(async (id: string): Promise<Pet | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const client = await createClient();
  if (!client) throw new Error("Supabase unavailable");
  const { data, error } = await client.from("zwierze").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[getPet error]", error);
    throw new Error(`Could not load pet: ${error.message} (${error.code})`);
  }
  if (data) {
    rememberPetHouseholdId((data as Pet).id, (data as Pet).gospodarstwo_id);
  }
  return data ? (await withAvatars(client, [data as Pet]))[0] : null;
});
