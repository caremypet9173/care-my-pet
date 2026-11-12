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
  summary_cache?: AssistantPdfSummary | null;
  summary_fingerprint?: string | null;
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

export type AssistantPdfSummary = {
  document_title: string;
  executive_summary: string;
  key_findings: string[];
  observations_for_owner: string[];
  questions_for_vet: string[];
  pet_name: string;
  species: string;
  breed: string;
  birth_date: string;
  latest_weight: string;
  generated_at: string;
  thread_title: string;
  sources: AssistantSource[];
};
