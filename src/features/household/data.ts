import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AvailableHouseholdItem, HouseholdDetailsResponse, HouseholdInfo } from "./types";

export async function getActiveHouseholdId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("care_active_household_id")?.value ?? null;
  } catch {
    return null;
  }
}

export async function isHouseholdOwner(): Promise<boolean> {
  const client = await createClient();
  if (!client) return false;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  const { data } = await client
    .from("gospodarstwo")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  return (data ?? []).length > 0;
}

export async function isPetHouseholdOwner(householdId: string): Promise<boolean> {
  const client = await createClient();
  if (!client) return false;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  const { data } = await client
    .from("gospodarstwo")
    .select("id")
    .eq("id", householdId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return !!data;
}

export async function getPetHouseholdAccess(householdId: string): Promise<{
  isOwner: boolean;
  canManage: boolean;
  hasRecoveryKey: boolean;
}> {
  const client = await createClient();
  if (!client) {
    return { isOwner: false, canManage: false, hasRecoveryKey: false };
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { isOwner: false, canManage: false, hasRecoveryKey: false };
  }

  const [{ data: householdRow }, { data: membership }] = await Promise.all([
    client
      .from("gospodarstwo")
      .select("id, owner_id, recovery_key_set_at")
      .eq("id", householdId)
      .maybeSingle(),
    client
      .from("czlonek_gospodarstwa")
      .select("rola")
      .eq("gospodarstwo_id", householdId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!householdRow) {
    return { isOwner: false, canManage: false, hasRecoveryKey: false };
  }

  const isOwner = householdRow.owner_id === user.id;
  const canManage = isOwner || membership?.rola === "admin";
  const hasRecoveryKey = Boolean(householdRow.recovery_key_set_at);
  return { isOwner, canManage, hasRecoveryKey };
}

export async function getActiveHouseholdContext(): Promise<{
  activeHousehold: HouseholdInfo | null;
  isOwner: boolean;
  canManage: boolean;
  hasRecoveryKey: boolean;
  availableHouseholds: AvailableHouseholdItem[];
}> {
  const details = await getHouseholdDetails();
  if (!details) {
    return {
      activeHousehold: null,
      isOwner: false,
      canManage: false,
      hasRecoveryKey: false,
      availableHouseholds: [],
    };
  }
  return {
    activeHousehold: details.household,
    isOwner: details.household.is_owner,
    canManage: details.household.can_manage,
    hasRecoveryKey: details.household.has_recovery_key,
    availableHouseholds: details.availableHouseholds ?? [],
  };
}

export async function getHouseholdDetails(
  selectedHouseholdId?: string | null,
): Promise<HouseholdDetailsResponse | null> {
  const client = await createClient();
  if (!client) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  // Pobierz własne gospodarstwa oraz wszystkie członkostwa użytkownika
  const [{ data: ownedHomes }, { data: memberHomes }] = await Promise.all([
    client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    client
      .from("czlonek_gospodarstwa")
      .select(
        "gospodarstwo_id, rola, created_at, gospodarstwo(id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  type HouseholdRow = {
    id: string;
    nazwa: string;
    owner_id: string;
    created_at: string;
    recovery_email: string | null;
    recovery_key_hint: string | null;
    recovery_key_set_at: string | null;
  };

  const list: AvailableHouseholdItem[] = [];
  for (const ownedHome of (ownedHomes ?? []) as HouseholdRow[]) {
    list.push({
      id: ownedHome.id,
      nazwa: ownedHome.nazwa || "Mój dom",
      rola: "owner",
      is_active: false,
    });
  }
  for (const m of memberHomes ?? []) {
    if (m.gospodarstwo) {
      const g = m.gospodarstwo as unknown as HouseholdRow;
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

  // Wybierz aktywne gospodarstwo (priorytet: selectedHouseholdId -> cookie -> ownedHomes -> memberHomes)
  let activeHousehold: HouseholdRow | null = null;
  let isOwner = false;
  let memberRole: "admin" | "member" | null = null;

  const cookieHouseholdId = await getActiveHouseholdId();
  const effectiveId = selectedHouseholdId || cookieHouseholdId;

  if (effectiveId) {
    const ownedMatch = ((ownedHomes ?? []) as HouseholdRow[]).find(
      (h) => h.id === effectiveId,
    );
    if (ownedMatch) {
      activeHousehold = ownedMatch;
      isOwner = true;
    } else {
      const found = (memberHomes ?? []).find(
        (m) => (m.gospodarstwo as unknown as { id: string })?.id === effectiveId,
      );
      if (found && found.gospodarstwo) {
        activeHousehold = found.gospodarstwo as unknown as HouseholdRow;
        isOwner = false;
        memberRole = found.rola === "admin" ? "admin" : "member";
      }
    }
  }

  // Domyślny wybór jeśli nie podano lub nie znaleziono wybranego
  if (!activeHousehold) {
    if (ownedHomes && ownedHomes.length > 0) {
      activeHousehold = ownedHomes[0] as HouseholdRow;
      isOwner = true;
    } else if (memberHomes && memberHomes.length > 0 && memberHomes[0].gospodarstwo) {
      activeHousehold = memberHomes[0].gospodarstwo as unknown as HouseholdRow;
      isOwner = false;
      memberRole = memberHomes[0].rola === "admin" ? "admin" : "member";
    }
  }

  // Fallback: jeśli brak czegokolwiek, pierwsze znalezione
  if (!activeHousehold) {
    const { data: anyHome } = await client
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at")
      .limit(1)
      .maybeSingle();

    if (!anyHome && !selectedHouseholdId) {
      const { data: createdHome } = await client
        .from("gospodarstwo")
        .insert({ owner_id: user.id, nazwa: "Mój dom" })
        .select(
          "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at",
        )
        .maybeSingle();

      if (!createdHome) return null;
      activeHousehold = createdHome as HouseholdRow;
      isOwner = true;
      memberRole = null;
      list.push({
        id: createdHome.id,
        nazwa: createdHome.nazwa || "Mój dom",
        rola: "owner",
        is_active: true,
      });
    } else if (!anyHome) {
      return null;
    } else {
      activeHousehold = anyHome as HouseholdRow;
      isOwner = activeHousehold.owner_id === user.id;
      const foundMember = (memberHomes ?? []).find(
        (m) => (m.gospodarstwo as unknown as { id: string })?.id === anyHome.id,
      );
      memberRole = foundMember?.rola === "admin" ? "admin" : isOwner ? null : "member";
      if (!list.some((it) => it.id === anyHome.id)) {
        list.push({
          id: anyHome.id,
          nazwa: anyHome.nazwa || "Mój dom",
          rola: isOwner ? "owner" : memberRole ?? "member",
          is_active: true,
        });
      }
    }
  }

  // Zaktualizuj is_active w liście
  for (const it of list) {
    it.is_active = it.id === activeHousehold.id;
  }

  const myRole: "owner" | "admin" | "member" = isOwner
    ? "owner"
    : memberRole === "admin"
      ? "admin"
      : "member";
  const canManage = myRole === "owner" || myRole === "admin";

  // Pobierz członków, zaproszenia, pupili oraz ewentualny wniosek o współadministrację
  const [membersRes, invitesRes, petsRes, adminReqRes] = await Promise.all([
    client
      .from("czlonek_gospodarstwa")
      .select("user_id, email, rola, created_at")
      .eq("gospodarstwo_id", activeHousehold.id)
      .order("created_at"),
    canManage
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
    client
      .from("household_admin_request")
      .select(
        "id, household_id, requester_user_id, requester_email, status, requested_at, resolves_at, resolved_at, resolved_by",
      )
      .eq("household_id", activeHousehold.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestReq = adminReqRes.data ?? null;
  const recentCutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const adminRequest =
    latestReq &&
    (latestReq.status === "pending" ||
      (latestReq.resolved_at &&
        new Date(latestReq.resolved_at).getTime() >= recentCutoffMs))
      ? (latestReq as HouseholdDetailsResponse["admin_request"])
      : null;

  return {
    household: {
      id: activeHousehold.id,
      nazwa: activeHousehold.nazwa,
      created_at: activeHousehold.created_at,
      is_owner: isOwner,
      can_manage: canManage,
      my_role: myRole,
      has_recovery_key: Boolean(activeHousehold.recovery_key_set_at),
      recovery_key_hint: canManage ? activeHousehold.recovery_key_hint ?? null : null,
      recovery_key_set_at: activeHousehold.recovery_key_set_at ?? null,
      recovery_email: canManage ? activeHousehold.recovery_email ?? null : null,
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
    admin_request: adminRequest,
  };
}
