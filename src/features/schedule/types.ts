export type ScheduleCategory = "visit" | "vaccination" | "prevention";
export type ScheduleStatus = "planned" | "completed" | "cancelled";

export type ScheduleItem = {
  id: string;
  pet_id: string;
  household_id: string;
  category: ScheduleCategory;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  clinic: string;
  doctor: string;
  prep_notes: string;
  status: ScheduleStatus;
  completed_event_id: string | null;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
