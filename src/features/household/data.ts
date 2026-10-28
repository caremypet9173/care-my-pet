import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdDetailsResponse } from "./types";

export async function getHouseholdDetails(): Promise<HouseholdDetailsResponse | null> {
  const client = await createClient();
  if (!client) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  // Pobierz gospodarstwo, w którym użytkownik jest właścicielem lub członkiem
  const [{ data: ownedHome }, { data: memberHome }] = await Promise.all([
    client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at")
      .eq("owner_id", user.id)
      .maybeSingle(),
    client
      .from("czlonek_gospodarstwa")
      .select("gospodarstwo_id, rola, created_at, gospodarstwo(id, nazwa, owner_id, created_at)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  let activeHousehold = ownedHome;
  let isOwner = true;

  if (!activeHousehold && memberHome?.gospodarstwo) {
    activeHousehold = memberHome.gospodarstwo as unknown as {
      id: string;
      nazwa: string;
      owner_id: string;
      created_at: string;
    };
    isOwner = false;
  }

  // Jeśli brak gospodarstwa, fallback lub pierwsze znalezione
  if (!activeHousehold) {
    const { data: anyHome } = await client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at")
      .limit(1)
      .maybeSingle();

    if (!anyHome) return null;
    activeHousehold = anyHome;
    isOwner = activeHousehold.owner_id === user.id;
  }

  // Pobierz członków, zaproszenia i pupili
  const [membersRes, invitesRes, petsRes] = await Promise.all([
    client
      .from("czlonek_gospodarstwa")
      .select("user_id, email, rola, created_at")
      .eq("gospodarstwo_id", activeHousehold.id)
      .order("created_at"),
    isOwner
      ? client
          .from("zaproszenie_gospodarstwa")
          .select("id, email, token, rola, status, invited_at, expires_at")
          .eq("gospodarstwo_id", activeHousehold.id)
          .eq("status", "pending")
          .order("invited_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    client
      .from("zwierze")
      .select("id, imie, gatunek, rasa, avatar_path")
      .eq("gospodarstwo_id", activeHousehold.id)
      .order("created_at"),
  ]);

  return {
    household: {
      id: activeHousehold.id,
      nazwa: activeHousehold.nazwa,
      created_at: activeHousehold.created_at,
      is_owner: isOwner,
    },
    owner: {
      user_id: activeHousehold.owner_id,
      email: isOwner ? user.email || null : null, // Właściciel widzi swój email
      rola: "owner",
      created_at: activeHousehold.created_at,
      is_self: isOwner,
    },
    members: (membersRes.data ?? []).map((m) => ({
      user_id: m.user_id,
      email: m.email,
      rola: m.rola as "member" | "admin",
      created_at: m.created_at,
      is_self: m.user_id === user.id,
    })),
    invitations: (invitesRes.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      token: i.token,
      rola: i.rola as "member" | "admin",
      status: i.status as "pending",
      invited_at: i.invited_at,
      expires_at: i.expires_at,
    })),
    pets: petsRes.data ?? [],
  };
}
