import type { Pet } from "@/features/pets/types";
import type { WeightMeasurement } from "@/features/weight/types";
import type { VitalMeasurement } from "@/features/measurements/types";
import type { PetFluidTherapy } from "@/features/fluid-therapy/types";
import type { HealthEvent } from "@/features/history/types";
import type { MedicalReport } from "@/features/medical/types";
import type { MedicationSchedule } from "@/features/medications/types";

export type PetArchiveLink = {
  id: string;
  pet_id: string;
  household_id: string;
  token: string;
  recipient_email: string;
  label: string;
  expires_at: string;
  revoked_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  unlocked_count: number;
  pdf_download_count: number;
  file_download_count: number;
  last_accessed_at: string | null;
  email_sent_at: string | null;
  created_by: string;
  created_at: string;
};

export type ArchiveAttachment = {
  id: string;
  source_type: "report" | "health_event";
  source_path: string;
  source_name: string;
  source_mime: string;
  title: string;
  date: string;
};

export type ArchiveMetaPayload = {
  status: "active" | "locked";
  pet_name: string;
  label: string;
  recipient_hint: string;
  expires_at: string;
  created_at: string;
  locked_until: string | null;
};

export type ArchiveMetaResult =
  | { status: "active" | "locked"; data: ArchiveMetaPayload }
  | { status: "expired"; expires_at?: string }
  | { status: "revoked"; revoked_at?: string }
  | { status: "not_found" };

export type ArchiveWeightRow = Pick<WeightMeasurement, "id" | "kg" | "measured_on" | "note">;

export type ArchiveVitalRow = Pick<
  VitalMeasurement,
  | "id"
  | "metric_type"
  | "value_primary"
  | "value_secondary"
  | "value_tertiary"
  | "unit"
  | "measured_on"
  | "measured_at"
  | "context"
  | "note"
>;

export type ArchiveFluidRow = Pick<
  PetFluidTherapy,
  | "id"
  | "fluid_name"
  | "volume_ml"
  | "route"
  | "medications_added"
  | "location"
  | "administered_at"
  | "administered_on"
  | "notes"
>;

export type ArchiveHealthEventRow = Pick<
  HealthEvent,
  | "id"
  | "category"
  | "title"
  | "event_date"
  | "next_due_date"
  | "clinic"
  | "doctor"
  | "batch_or_product"
  | "description"
  | "source_path"
  | "source_name"
  | "source_mime"
>;

export type ArchiveMedicationRow = Pick<
  MedicationSchedule,
  | "id"
  | "name"
  | "dosage"
  | "schedule_type"
  | "interval_value"
  | "interval_unit"
  | "start_date"
  | "end_date"
  | "scheduled_time"
  | "scheduled_times"
  | "instructions"
  | "is_active"
  | "schedule_category"
  | "fluid_name"
  | "fluid_volume_ml"
  | "fluid_route"
  | "fluid_location"
>;

export type ArchiveMedicalReport = Omit<MedicalReport, "confirmed_at">;

export type PetArchivePayload = {
  session_token: string;
  archive: {
    id: string;
    label: string;
    recipient_hint: string;
    created_at: string;
    expires_at: string;
    unlocked_count: number;
  };
  pet: Omit<Pet, "gospodarstwo_id" | "archived_by" | "archive_note" | "report_count">;
  weights: ArchiveWeightRow[];
  vital_measurements: ArchiveVitalRow[];
  fluid_therapies: ArchiveFluidRow[];
  health_events: ArchiveHealthEventRow[];
  reports: ArchiveMedicalReport[];
  medication_schedules: ArchiveMedicationRow[];
  attachments: ArchiveAttachment[];
};
