import "server-only";
import { cache } from "react";
import { createClient, getCurrentUserClaims } from "@/lib/supabase/server";
import type { PetPageHouseholdSummary } from "@/features/household/data";
import type {
  MeasurementCorrection,
  MedicalReport,
  TrashedMedicalReport,
} from "@/features/medical/types";
import type { WeightMeasurement } from "@/features/weight/types";
import type { VitalMeasurement } from "@/features/measurements/types";
import type { PetFluidTherapy } from "@/features/fluid-therapy/types";
import type { HealthEvent } from "@/features/history/types";
import type {
  HouseholdNotificationSettings,
  ScheduleItem,
} from "@/features/schedule/types";
import type {
  MedicationLog,
  MedicationSchedule,
} from "@/features/medications/types";
import type { Pet } from "./types";
import type { PetSwitcherItem } from "./pet-switcher";
import { rememberPetHouseholdId, withAvatars } from "./data";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawHousehold = {
  id: string;
  nazwa: string;
  owner_id: string;
  recovery_email: string | null;
  recovery_key_set_at: string | null;
};

type RawMember = {
  user_id: string;
  email: string | null;
  rola: string;
};

type RawSwitcherPet = {
  id: string;
  imie: string;
  gatunek: Pet["gatunek"];
  avatar_path: string | null;
  tagi: string[] | null;
  created_at?: string;
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

type RawReportRow = MedicalReport["rows"][number] & {
  correction: MeasurementCorrection | null;
};

type RawReport = Omit<MedicalReport, "rows"> & {
  rows: RawReportRow[];
};

type RawPetRecordBundle = {
  pet: Pet | null;
  household: RawHousehold | null;
  members: RawMember[] | null;
  switcher_pets: RawSwitcherPet[] | null;
  notification_settings: RawNotificationSettings | null;
  reports: RawReport[] | null;
  trashed_reports: TrashedMedicalReport[] | null;
  weights: WeightMeasurement[] | null;
  vital_measurements: VitalMeasurement[] | null;
  fluids: PetFluidTherapy[] | null;
  health_events: HealthEvent[] | null;
  schedule_items: ScheduleItem[] | null;
  medication_schedules: MedicationSchedule[] | null;
  medication_logs: MedicationLog[] | null;
};

export interface PetRecordBundle {
  pet: Pet;
  householdDetails: PetPageHouseholdSummary | null;
  switcherPets: PetSwitcherItem[];
  notificationSettings: HouseholdNotificationSettings;
  reports: MedicalReport[];
  trashedReports: TrashedMedicalReport[];
  weights: WeightMeasurement[];
  vitalMeasurements: VitalMeasurement[];
  fluids: PetFluidTherapy[];
  healthEvents: HealthEvent[];
  scheduleItems: ScheduleItem[];
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

/**
 * Single-round-trip loader for `/app/pets/[id]`.
 * Runs 1 SECURITY INVOKER RPC + in-memory JWKS claims check, then signs only
 * uncached pet avatars in a single Storage batch. Cached per request via
 * React.cache() so `generateMetadata` and `PetPage` share the exact call.
 */
export const getPetRecordBundle = cache(
  async (petId: string): Promise<PetRecordBundle | null> => {
    if (!UUID_RE.test(petId)) {
      return null;
    }

    const [{ user }, client] = await Promise.all([
      getCurrentUserClaims(),
      createClient(),
    ]);
    if (!user) return null;
    if (!client) throw new Error("Supabase unavailable");

    const { data, error } = await client.rpc("get_pet_record_bundle", {
      p_pet_id: petId,
    });

    if (error) {
      console.error("[getPetRecordBundle error]", error);
      throw new Error(
        `Could not load pet record: ${error.message} (${error.code})`,
      );
    }

    const raw = data as RawPetRecordBundle | null;
    if (!raw?.pet) {
      return null;
    }

    const rawPet: Pet = {
      ...raw.pet,
      tagi: Array.isArray(raw.pet.tagi) ? raw.pet.tagi : [],
    };
    rememberPetHouseholdId(rawPet.id, rawPet.gospodarstwo_id);

    const rawSwitcher = rawPet.archived_at
      ? []
      : Array.isArray(raw.switcher_pets)
        ? raw.switcher_pets
        : [];
    for (const sp of rawSwitcher) {
      rememberPetHouseholdId(sp.id, rawPet.gospodarstwo_id);
    }

    const signedTargets = await withAvatars(client, [
      { avatar_path: rawPet.avatar_path, avatar_url: null as string | null },
      ...rawSwitcher.map((sp) => ({
        avatar_path: sp.avatar_path,
        avatar_url: null as string | null,
      })),
    ]);

    const pet: Pet = {
      ...rawPet,
      avatar_url: signedTargets[0]?.avatar_url ?? null,
    };

    const switcherPets: PetSwitcherItem[] = rawSwitcher.map((sp, idx) => ({
      id: sp.id,
      imie: sp.imie,
      gatunek: sp.gatunek,
      avatar_url: signedTargets[idx + 1]?.avatar_url ?? null,
      tagi: Array.isArray(sp.tagi) ? sp.tagi : [],
    }));

    let householdDetails: PetPageHouseholdSummary | null = null;
    if (user && raw.household) {
      const h = raw.household;
      const isOwner = h.owner_id === user.id;
      const members = (Array.isArray(raw.members) ? raw.members : []).map(
        (m) => ({
          user_id: m.user_id,
          email: m.email,
          rola: (m.rola === "admin" ? "admin" : "member") as "member" | "admin",
          is_self: m.user_id === user.id,
        }),
      );
      const myMembership = members.find((m) => m.is_self);
      const canManage = isOwner || myMembership?.rola === "admin";
      householdDetails = {
        household: {
          id: h.id,
          nazwa: h.nazwa,
          is_owner: isOwner,
          can_manage: canManage,
          has_recovery_key: Boolean(h.recovery_key_set_at),
          recovery_email: canManage ? h.recovery_email ?? null : null,
        },
        owner: {
          user_id: h.owner_id,
          email: isOwner ? (user.email ?? null) : null,
          is_self: isOwner,
        },
        members,
      };
    }

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

    const reports: MedicalReport[] = (
      Array.isArray(raw.reports) ? raw.reports : []
    ).map((report) => ({
      ...report,
      rows: (Array.isArray(report.rows) ? report.rows : [])
        .map(({ correction, ...row }) => ({
          ...row,
          original: {
            value: row.value,
            unit: row.unit,
            reference: row.reference,
          },
          ...(correction
            ? {
                value: correction.value,
                unit: correction.unit,
                reference: correction.reference,
                note: correction.note,
                is_key: correction.is_key,
                revision: correction.revision,
              }
            : { revision: 0 }),
        }))
        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)),
    }));

    return {
      pet,
      householdDetails,
      switcherPets,
      notificationSettings,
      reports,
      trashedReports: Array.isArray(raw.trashed_reports)
        ? raw.trashed_reports
        : [],
      weights: Array.isArray(raw.weights) ? raw.weights : [],
      vitalMeasurements: Array.isArray(raw.vital_measurements)
        ? raw.vital_measurements
        : [],
      fluids: Array.isArray(raw.fluids) ? raw.fluids : [],
      healthEvents: Array.isArray(raw.health_events) ? raw.health_events : [],
      scheduleItems: Array.isArray(raw.schedule_items)
        ? raw.schedule_items
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
