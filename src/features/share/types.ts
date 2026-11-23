import type { Pet } from "@/features/pets/types";
import type { WeightMeasurement } from "@/features/weight/types";
import type { HealthEvent } from "@/features/history/types";
import type { MedicalReport } from "@/features/medical/types";
import type { ScheduleItem } from "@/features/schedule/types";

export type ShareTtlHours = 1 | 24 | 168;

export type PetShareLink = {
  id: string;
  pet_id: string;
  household_id: string;
  token: string;
  label: string;
  ttl_hours: ShareTtlHours;
  expires_at: string;
  revoked_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  created_by: string;
  created_at: string;
};

export type PetShareOpenLog = {
  id: string;
  share_link_id: string;
  pet_id: string;
  household_id: string;
  opened_at: string;
  user_agent: string;
};

export type SharedPetRecordPayload = {
  share: {
    id: string;
    label: string;
    ttl_hours: number;
    created_at: string;
    expires_at: string;
    open_count: number;
  };
  pet: Pet;
  weights: WeightMeasurement[];
  health_events: HealthEvent[];
  reports: MedicalReport[];
  schedule_items: ScheduleItem[];
};
