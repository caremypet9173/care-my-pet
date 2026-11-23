import "server-only";
import { cache } from "react";
import { createClient, getCurrentUserClaims } from "@/lib/supabase/server";
import { getActiveHouseholdContext } from "@/features/household/data";
import type { HealthEvent } from "@/features/history/types";
import type {
  CalendarReportSummary,
  HouseholdNotificationSettings,
  ScheduleItem,
} from "@/features/schedule/types";
import type {
  MedicationLog,
  MedicationSchedule,
} from "@/features/medications/types";
import type { Pet } from "./types";
import { rememberPetHouseholdId, withAvatars } from "./data";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawDashboardHousehold = {
  id: string;
  nazwa: string;
  owner_id: string;
  is_owner: boolean;
  can_manage: boolean;
  has_recovery_key: boolean;
  recovery_email: string | null;
};

type RawNotificationSettings = {
  id?: string;
  household_id?: string;
  email_enabled: boolean;
  notify_7_days_before: boolean;
  notify_1_day_before: boolean;
  notify_day_of: boolean;
  custom_email: string | null;
};

type RawDashboardBundle = {
  household: RawDashboardHousehold | null;
  pets: Pet[] | null;
  health_events: HealthEvent[] | null;
  schedule_items: ScheduleItem[] | null;
  notification_settings: RawNotificationSettings | null;
  reports_summary: CalendarReportSummary[] | null;
  medication_schedules: MedicationSchedule[] | null;
  medication_logs: MedicationLog[] | null;
};

export interface HouseholdDashboardBundle {
  activeHousehold: {
    id: string;
    nazwa: string;
    recovery_email: string | null;
  } | null;
  isOwner: boolean;
  canManage: boolean;
  hasRecoveryKey: boolean;
  ownerEmail: string;
  pets: Pet[] | null;
  healthEvents: HealthEvent[];
  scheduleItems: ScheduleItem[];
  notificationSettings: HouseholdNotificationSettings;
  reportsSummary: CalendarReportSummary[];
  medicationSchedules: MedicationSchedule[];
  medicationLogs: MedicationLog[];
}

const DEFAULT_NOTIFICATION_SETTINGS: HouseholdNotificationSettings = {
  email_enabled: true,
  notify_7_days_before: true,
  notify_1_day_before: true,
  notify_day_of: false,
  custom_email: "",
};

function failedBundle(): HouseholdDashboardBundle {
  return {
    activeHousehold: null,
    isOwner: false,
    canManage: false,
    hasRecoveryKey: false,
    ownerEmail: "",
    pets: null,
    healthEvents: [],
    scheduleItems: [],
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    reportsSummary: [],
    medicationSchedules: [],
    medicationLogs: [],
  };
}

/**
 * Single-round-trip loader for `/app`.
 * Runs 1 SECURITY INVOKER RPC + in-memory JWKS claims check, then signs only
 * uncached pet avatars in a single Storage batch.
 */
export const getHouseholdDashboardBundle = cache(
  async (
    selectedHouseholdId?: string | null,
  ): Promise<HouseholdDashboardBundle> => {
    const validSelectedId =
      selectedHouseholdId && UUID_RE.test(selectedHouseholdId)
        ? selectedHouseholdId
        : null;

    const [{ user }, client] = await Promise.all([
      getCurrentUserClaims(),
      createClient(),
    ]);
    if (!user || !client) {
      return failedBundle();
    }

    const { data, error } = await client.rpc("get_household_dashboard_bundle", {
      p_selected_household_id: validSelectedId,
    });

    if (error) {
      console.error("[getHouseholdDashboardBundle error]", error);
      return failedBundle();
    }

    const raw = data as RawDashboardBundle | null;
    if (!raw?.household) {
      // Brand-new user with 0 households: auto-create initial household via fallback.
      const fallback = await getActiveHouseholdContext();
      return {
        activeHousehold: fallback.activeHousehold
          ? {
              id: fallback.activeHousehold.id,
              nazwa: fallback.activeHousehold.nazwa,
              recovery_email: fallback.activeHousehold.recovery_email,
            }
          : null,
        isOwner: fallback.isOwner,
        canManage: fallback.canManage,
        hasRecoveryKey: fallback.hasRecoveryKey,
        ownerEmail: fallback.isOwner ? (user?.email ?? "") : "",
        pets: [],
        healthEvents: [],
        scheduleItems: [],
        notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
        reportsSummary: [],
        medicationSchedules: [],
        medicationLogs: [],
      };
    }

    const h = raw.household;
    const rawPets = (Array.isArray(raw.pets) ? raw.pets : []).map((pet) => {
      rememberPetHouseholdId(pet.id, pet.gospodarstwo_id);
      return {
        ...pet,
        tagi: Array.isArray(pet.tagi) ? pet.tagi : [],
        report_count: Number(pet.report_count ?? 0),
      };
    });
    const pets = await withAvatars(client, rawPets);

    const ns = raw.notification_settings;
    const notificationSettings: HouseholdNotificationSettings = ns
      ? {
          id: ns.id,
          household_id: ns.household_id,
          email_enabled: Boolean(ns.email_enabled),
          notify_7_days_before: Boolean(ns.notify_7_days_before),
          notify_1_day_before: Boolean(ns.notify_1_day_before),
          notify_day_of: Boolean(ns.notify_day_of),
          custom_email: String(ns.custom_email ?? ""),
        }
      : DEFAULT_NOTIFICATION_SETTINGS;

    return {
      activeHousehold: {
        id: h.id,
        nazwa: h.nazwa,
        recovery_email: h.recovery_email ?? null,
      },
      isOwner: Boolean(h.is_owner),
      canManage: Boolean(h.can_manage),
      hasRecoveryKey: Boolean(h.has_recovery_key),
      ownerEmail: h.is_owner ? (user?.email ?? "") : "",
      pets,
      healthEvents: Array.isArray(raw.health_events) ? raw.health_events : [],
      scheduleItems: Array.isArray(raw.schedule_items)
        ? raw.schedule_items
        : [],
      notificationSettings,
      reportsSummary: Array.isArray(raw.reports_summary)
        ? raw.reports_summary
        : [],
      medicationSchedules: Array.isArray(raw.medication_schedules)
        ? raw.medication_schedules
        : [],
      medicationLogs: Array.isArray(raw.medication_logs)
        ? raw.medication_logs
        : [],
    };
  },
);
