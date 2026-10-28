import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AvailableHouseholdItem, HouseholdDetailsResponse } from "./types";

export async function getHouseholdDetails(
  selectedHouseholdId?: string | null,
): Promise<HouseholdDetailsResponse | null> {
  const client = await createClient();
  if (!client) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  // Pobierz własne gospodarstwo oraz wszystkie członkostwa użytkownika
  const [{ data: ownedHome }, { data: memberHomes }] = await Promise.all([
    client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at")
      .eq("owner_id", user.id)
      .maybeSingle(),
    client
      .from("czlonek_gospodarstwa")
      .select("gospodarstwo_id, rola, created_at, gospodarstwo(id, nazwa, owner_id, created_at)")
      .eq("user_id", user.id),
  ]);

  const list: AvailableHouseholdItem[] = [];
  if (ownedHome) {
    list.push({
      id: ownedHome.id,
      nazwa: ownedHome.nazwa || "Mój dom",
      rola: "owner",
      is_active: false,
    });
  }
  for (const m of memberHomes ?? []) {
    if (m.gospodarstwo) {
      const g = m.gospodarstwo as unknown as { id: string; nazwa: string };
      if (!list.some((it) => it.id === g.id)) {
        list.push({
          id: g.id,
          nazwa: g.nazwa || "Gospodarstwo",
          rola: (m.rola as "admin" | "member") || "member",
          is_active: false,
        });
      }
    }
  }

  // Wybierz aktywne gospodarstwo
  let activeHousehold: { id: string; nazwa: string; owner_id: string; created_at: string } | null = null;
  let isOwner = false;

  if (selectedHouseholdId) {
    if (ownedHome && ownedHome.id === selectedHouseholdId) {
      activeHousehold = ownedHome;
      isOwner = true;
    } else {
      const found = (memberHomes ?? []).find(
        (m) => (m.gospodarstwo as unknown as { id: string })?.id === selectedHouseholdId,
      );
      if (found && found.gospodarstwo) {
        activeHousehold = found.gospodarstwo as unknown as {
          id: string;
          nazwa: string;
          owner_id: string;
          created_at: string;
        };
        isOwner = false;
      }
    }
  }

  // Domyślny wybór jeśli nie podano lub nie znaleziono wybranego
  if (!activeHousehold) {
    if (ownedHome) {
      activeHousehold = ownedHome;
      isOwner = true;
    } else if (memberHomes && memberHomes.length > 0 && memberHomes[0].gospodarstwo) {
      activeHousehold = memberHomes[0].gospodarstwo as unknown as {
        id: string;
        nazwa: string;
        owner_id: string;
        created_at: string;
      };
      isOwner = false;
    }
  }

  // Fallback: jeśli brak czegokolwiek, pierwsze znalezione
  if (!activeHousehold) {
    const { data: anyHome } = await client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at")
      .limit(1)
      .maybeSingle();

    if (!anyHome) return null;
    activeHousehold = anyHome;
    isOwner = activeHousehold.owner_id === user.id;
    if (!list.some((it) => it.id === anyHome.id)) {
      list.push({
        id: anyHome.id,
        nazwa: anyHome.nazwa || "Mój dom",
        rola: isOwner ? "owner" : "member",
        is_active: true,
      });
    }
  }

  // Zaktualizuj is_active w liście
  for (const it of list) {
    it.is_active = it.id === activeHousehold.id;
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
    availableHouseholds: list,
  };
}
