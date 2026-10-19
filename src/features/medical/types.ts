export type MeasurementCorrection = {value:string;unit:string;reference:string;note:string;is_key:boolean;revision:number};
export type Measurement = { id?:string; value_type?:"decimal"|"text"; name: string; value: string; unit: string; reference: string; category: "blood" | "renal" | "liver" | "other"; ordinal?: number; note?:string;is_key?:boolean;revision?:number;original?:{value:string;unit:string;reference:string} };
export type ReportDraft = { title: string; test_date: string; laboratory: string; doctor: string; notes: string; rows: Measurement[] };
export type MedicalReport = ReportDraft & { id: string; source_path: string; source_name: string; source_mime: string; confirmed_at: string };
