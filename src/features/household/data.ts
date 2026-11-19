import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type {
  AvailableHouseholdItem,
  HouseholdDetailsResponse,
  HouseholdInfo,
} from "./types";

type HouseholdRow = {
  id: string;
  nazwa: string;
  owner_id: string;
  created_at: string;
  recovery_email: string | null;
  recovery_key_hint: string | null;
  recovery_key_set_at: string | null;
};

type ResolvedHouseholdState = {
  userId: string;
  userEmail: string | null;
  activeHousehold: HouseholdRow;
  isOwner: boolean;
  canManage: boolean;
  myRole: "owner" | "admin" | "member";
  householdInfo: HouseholdInfo;
  availableHouseholds: AvailableHouseholdItem[];
};

export const getActiveHouseholdId = cache(async (): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("care_active_household_id")?.value ?? null;
  } catch {
    return null;
  }
});

/**
 * Lightweight household resolver (2 DB queries: owned + memberships),
 * deduplicated per request with React.cache().
 */
const resolveActiveHousehold = cache(
  async (
    selectedHouseholdId?: string | null,
  ): Promise<ResolvedHouseholdState | null> => {
    const client = await createClient();
    if (!client) return null;

    const { user } = await getCurrentUser();
    if (!user) return null;

    const [{ data: ownedHomes }, { data: memberHomes }] = await Promise.all([
      client
        .from("gospodarstwo")
        .select(
          "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at",
        )
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
          (m) =>
            (m.gospodarstwo as unknown as { id: string })?.id === effectiveId,
        );
        if (found && found.gospodarstwo) {
          activeHousehold = found.gospodarstwo as unknown as HouseholdRow;
          isOwner = false;
          memberRole = found.rola === "admin" ? "admin" : "member";
        }
      }
    }

    if (!activeHousehold) {
      if (ownedHomes && ownedHomes.length > 0) {
        activeHousehold = ownedHomes[0] as HouseholdRow;
        isOwner = true;
      } else if (
        memberHomes &&
        memberHomes.length > 0 &&
        memberHomes[0].gospodarstwo
      ) {
        activeHousehold = memberHomes[0]
          .gospodarstwo as unknown as HouseholdRow;
        isOwner = false;
        memberRole = memberHomes[0].rola === "admin" ? "admin" : "member";
      }
    }

    if (!activeHousehold) {
      const { data: anyHome } = await client
        .from("gospodarstwo")
        .select(
          "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at",
        )
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
        memberRole =
          foundMember?.rola === "admin" ? "admin" : isOwner ? null : "member";
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

    for (const it of list) {
      it.is_active = it.id === activeHousehold.id;
    }

    const myRole: "owner" | "admin" | "member" = isOwner
      ? "owner"
      : memberRole === "admin"
        ? "admin"
        : "member";
    const canManage = myRole === "owner" || myRole === "admin";

    const householdInfo: HouseholdInfo = {
      id: activeHousehold.id,
      nazwa: activeHousehold.nazwa,
      created_at: activeHousehold.created_at,
      is_owner: isOwner,
      can_manage: canManage,
      my_role: myRole,
      has_recovery_key: Boolean(activeHousehold.recovery_key_set_at),
      recovery_key_hint: canManage
        ? activeHousehold.recovery_key_hint ?? null
        : null,
      recovery_key_set_at: activeHousehold.recovery_key_set_at ?? null,
      recovery_email: canManage
        ? activeHousehold.recovery_email ?? null
        : null,
    };

    return {
      userId: user.id,
      userEmail: user.email ?? null,
      activeHousehold,
      isOwner,
      canManage,
      myRole,
      householdInfo,
      availableHouseholds: list,
    };
  },
);

export const isHouseholdOwner = cache(async (): Promise<boolean> => {
  const client = await createClient();
  if (!client) return false;
  const { user } = await getCurrentUser();
  if (!user) return false;

  const { data } = await client
    .from("gospodarstwo")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  return (data ?? []).length > 0;
});

export const isPetHouseholdOwner = cache(
  async (householdId: string): Promise<boolean> => {
    const client = await createClient();
    if (!client) return false;
    const { user } = await getCurrentUser();
    if (!user) return false;

    const { data } = await client
      .from("gospodarstwo")
      .select("id")
      .eq("id", householdId)
      .eq("owner_id", user.id)
      .maybeSingle();

    return !!data;
  },
);

export const getPetHouseholdAccess = cache(
  async (
    householdId: string,
  ): Promise<{
    isOwner: boolean;
    canManage: boolean;
    hasRecoveryKey: boolean;
  }> => {
    const client = await createClient();
    if (!client) {
      return { isOwner: false, canManage: false, hasRecoveryKey: false };
    }
    const { user } = await getCurrentUser();
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
  },
);

export const getActiveHouseholdContext = cache(
  async (): Promise<{
    activeHousehold: HouseholdInfo | null;
    isOwner: boolean;
    canManage: boolean;
    hasRecoveryKey: boolean;
    availableHouseholds: AvailableHouseholdItem[];
  }> => {
    const resolved = await resolveActiveHousehold();
    if (!resolved) {
      return {
        activeHousehold: null,
        isOwner: false,
        canManage: false,
        hasRecoveryKey: false,
        availableHouseholds: [],
      };
    }
    return {
      activeHousehold: resolved.householdInfo,
      isOwner: resolved.isOwner,
      canManage: resolved.canManage,
      hasRecoveryKey: resolved.householdInfo.has_recovery_key,
      availableHouseholds: resolved.availableHouseholds,
    };
  },
);

export const getHouseholdDetails = cache(
  async (
    selectedHouseholdId?: string | null,
  ): Promise<HouseholdDetailsResponse | null> => {
    const client = await createClient();
    if (!client) return null;

    const resolved = await resolveActiveHousehold(selectedHouseholdId);
    if (!resolved) return null;

    const {
      userId,
      userEmail,
      activeHousehold,
      isOwner,
      canManage,
      householdInfo,
      availableHouseholds,
    } = resolved;

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
      household: householdInfo,
      owner: {
        user_id: activeHousehold.owner_id,
        email: isOwner ? userEmail : null,
        rola: "owner",
        created_at: activeHousehold.created_at,
        is_self: isOwner,
      },
      members: (membersRes.data ?? []).map((m) => ({
        user_id: m.user_id,
        email: m.email,
        rola: m.rola as "member" | "admin",
        created_at: m.created_at,
        is_self: m.user_id === userId,
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
      availableHouseholds,
      admin_request: adminRequest,
    };
  },
);
