export type AssistantSource = {
  source_type: "medical_report" | "health_event";
  source_id: string;
  event_date: string;
  title: string;
};

export type AssistantThread = {
  id: string;
  pet_id: string;
  household_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AssistantMessage = {
  id: string;
  thread_id: string;
  pet_id: string;
  household_id: string;
  role: "user" | "assistant";
  content: string;
  sources: AssistantSource[];
  follow_ups: string[];
  created_by: string;
  created_at: string;
};
