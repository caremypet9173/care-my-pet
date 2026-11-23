export type MeasurementCorrection = {value:string;unit:string;reference:string;note:string;is_key:boolean;revision:number};
export type Measurement = { id?:string; value_type?:"decimal"|"text"; name: string; value: string; unit: string; reference: string; category: "blood" | "renal" | "liver" | "other"; ordinal?: number; note?:string;is_key?:boolean;revision?:number;original?:{value:string;unit:string;reference:string} };
export type ReportDraft = { title: string; test_date: string; laboratory: string; doctor: string; notes: string; ai_interpretation?: string; rows: Measurement[] };
export type MedicalReport = ReportDraft & { id: string; source_path: string; source_name: string; source_mime: string; confirmed_at: string; ai_interpretation?: string };
export type TrashedMedicalReport = {
  id: string;
  title: string;
  test_date: string;
  laboratory: string;
  doctor: string;
  source_name: string;
  source_mime: string;
  deleted_at: string;
  row_count: number;
};
export type AiQuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
};
export type TrashedSamePetMatch = {
  id: string;
  title: string;
  test_date: string;
  deleted_at: string;
};
export type HouseholdHashMatch = {
  id: string;
  pet_id: string;
  pet_name: string;
  pet_archived: boolean;
  title: string;
  test_date: string;
  status: "active" | "trashed";
  deleted_at: string | null;
};
export type RejectedDocumentInfo = {
  document_type: "non_medical" | "unreadable";
  reason: string;
};
