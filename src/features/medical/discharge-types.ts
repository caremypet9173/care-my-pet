export type LabCategory = "blood" | "renal" | "liver" | "other";

export interface DischargeParameter {
  name: string;
  value: string;
  unit: string;
  reference: string;
  category: LabCategory;
}

export interface DischargeLabReport {
  id: string;
  date: string;
  category: string;
  title: string;
  laboratory: string;
  doctor: string;
  notes: string;
  ai_interpretation: string;
  parameters: DischargeParameter[];
  selected: boolean;
}

export interface DischargeClinicalEvent {
  id: string;
  date: string;
  category: "visit" | "vaccination" | "prevention";
  title: string;
  clinic: string;
  doctor: string;
  description: string;
  batch_or_product: string;
  selected: boolean;
}

export interface DischargeMeasurement {
  id: string;
  date: string;
  type: "weight" | "blood_pressure" | "temperature";
  value: number;
  raw_value: string;
  note: string;
  selected: boolean;
}

export interface DischargeMedication {
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
  selected: boolean;
}

export interface RawDischargeExtraction {
  clinic_name: string;
  patient_name: string;
  species: string;
  summary: string;
  lab_reports: Array<{
    date: string;
    category: string;
    title: string;
    laboratory?: string;
    doctor?: string;
    notes?: string;
    ai_interpretation?: string;
    parameters?: Array<{
      name: string;
      value: string;
      unit?: string;
      reference?: string;
      category?: string;
    }>;
  }>;
  clinical_events: Array<{
    date: string;
    category: string;
    title: string;
    clinic?: string;
    doctor?: string;
    description?: string;
    batch_or_product?: string;
  }>;
  measurements: Array<{
    date: string;
    type: string;
    value: number;
    raw_value?: string;
    note?: string;
  }>;
  medications: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    instructions?: string;
  }>;
}

export interface DischargeParsedState {
  clinic_name: string;
  patient_name: string;
  species: string;
  summary: string;
  lab_reports: DischargeLabReport[];
  clinical_events: DischargeClinicalEvent[];
  measurements: DischargeMeasurement[];
  medications: DischargeMedication[];
}
