export type MedicationScheduleType = "one_off" | "daily" | "interval";
export type IntervalUnit = "days" | "weeks" | "months";
export type DoseLogStatus = "taken" | "skipped";

export type MedicationSchedule = {
  id: string;
  pet_id: string;
  household_id: string;
  name: string;
  dosage: string;
  schedule_type: MedicationScheduleType;
  interval_value: number | null;
  interval_unit: IntervalUnit | null;
  start_date: string;
  end_date: string | null;
  scheduled_time: string;
  scheduled_times?: string[];
  instructions: string;
  is_active: boolean;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MedicationLog = {
  id: string;
  schedule_id: string | null;
  pet_id: string;
  household_id: string;
  dose_date: string;
  scheduled_time: string;
  administered_at: string;
  status: DoseLogStatus;
  administered_by: string | null;
  notes: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectedMedicationDose = {
  key: string;
  schedule_id: string;
  pet_id: string;
  name: string;
  dosage: string;
  schedule_type: MedicationScheduleType;
  dose_date: string;
  scheduled_time: string;
  instructions: string;
  is_completed: boolean;
  log?: MedicationLog;
};
