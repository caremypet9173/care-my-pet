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
  notify_emails?: string[];
  status: ScheduleStatus;
  completed_event_id: string | null;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HouseholdNotificationSettings = {
  id?: string;
  household_id?: string;
  email_enabled: boolean;
  notify_7_days_before: boolean;
  notify_1_day_before: boolean;
  notify_day_of: boolean;
  custom_email: string;
};

export type CalendarReportSummary = {
  id: string;
  pet_id: string;
  title: string;
  test_date: string;
  laboratory: string;
  doctor: string;
};


