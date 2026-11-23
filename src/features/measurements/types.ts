export type MetricType = "weight" | "blood_pressure" | "glucose" | "temperature";

export interface VitalMeasurement {
  id: string;
  pet_id: string;
  household_id: string;
  metric_type: "blood_pressure" | "glucose" | "temperature";
  value_primary: number;
  value_secondary: number | null;
  value_tertiary: number | null;
  unit: "mmHg" | "mg/dL" | "°C";
  context: string;
  measured_at: string;
  measured_on: string;
  note: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type BloodPressureRiskStage = "normal" | "prehypertension" | "hypertension" | "severe";

export function getBloodPressureStage(sap: number): {
  stage: BloodPressureRiskStage;
  labelPl: string;
  labelEn: string;
  riskPl: string;
  riskEn: string;
  colorClass: string;
} {
  if (sap < 140) {
    return {
      stage: "normal",
      labelPl: "Norma",
      labelEn: "Normal",
      riskPl: "Minimalne ryzyko powikłań (TOD <140 mmHg)",
      riskEn: "Minimal risk of TOD (<140 mmHg)",
      colorClass: "stage-normal",
    };
  }
  if (sap < 160) {
    return {
      stage: "prehypertension",
      labelPl: "Stan graniczny",
      labelEn: "Prehypertensive",
      riskPl: "Niskie ryzyko powikłań (140–159 mmHg)",
      riskEn: "Low risk of TOD (140–159 mmHg)",
      colorClass: "stage-borderline",
    };
  }
  if (sap < 180) {
    return {
      stage: "hypertension",
      labelPl: "Nadciśnienie tętnicze",
      labelEn: "Hypertension",
      riskPl: "Umiarkowane ryzyko uszkodzenia narządów (160–179 mmHg)",
      riskEn: "Moderate risk of organ damage (160–179 mmHg)",
      colorClass: "stage-hypertension",
    };
  }
  return {
    stage: "severe",
    labelPl: "Ciężkie nadciśnienie",
    labelEn: "Severe hypertension",
    riskPl: "Wysokie ryzyko uszkodzenia narządów docelowych (≥180 mmHg)",
    riskEn: "High risk of target organ damage (≥180 mmHg)",
    colorClass: "stage-severe",
  };
}

export type GlucoseStatus = "hypo" | "normal" | "elevated" | "hyper";

export function getGlucoseStatus(mgDl: number): {
  status: GlucoseStatus;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
  colorClass: string;
} {
  if (mgDl < 70) {
    return {
      status: "hypo",
      labelPl: "Hipoglikemia",
      labelEn: "Hypoglycemia",
      descPl: "Zbyt niski poziom cukru (< 70 mg/dL)",
      descEn: "Low blood glucose (< 70 mg/dL)",
      colorClass: "stage-severe",
    };
  }
  if (mgDl <= 150) {
    return {
      status: "normal",
      labelPl: "Norma fizjologiczna",
      labelEn: "Normal",
      descPl: "Prawidłowy poziom glukozy (70–150 mg/dL)",
      descEn: "Physiological blood glucose (70–150 mg/dL)",
      colorClass: "stage-normal",
    };
  }
  if (mgDl <= 180) {
    return {
      status: "elevated",
      labelPl: "Podwyższona",
      labelEn: "Elevated",
      descPl: "Stan lekko podwyższony / stresowy (151–180 mg/dL)",
      descEn: "Slightly elevated / stress reaction (151–180 mg/dL)",
      colorClass: "stage-borderline",
    };
  }
  return {
    status: "hyper",
    labelPl: "Hiperglikemia",
    labelEn: "Hyperglycemia",
    descPl: "Powyżej progu nerkowego (> 180 mg/dL)",
    descEn: "Above renal threshold (> 180 mg/dL)",
    colorClass: "stage-hypertension",
  };
}

export type TemperatureStatus = "hypothermia" | "normal" | "subfebrile" | "fever";

export function getTemperatureStatus(celsius: number): {
  status: TemperatureStatus;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
  colorClass: string;
} {
  if (celsius < 37.5) {
    return {
      status: "hypothermia",
      labelPl: "Hipotermia",
      labelEn: "Hypothermia",
      descPl: "Temperatura poniżej normy (< 37.5°C)",
      descEn: "Subnormal temperature (< 37.5°C)",
      colorClass: "stage-cold",
    };
  }
  if (celsius <= 39.0) {
    return {
      status: "normal",
      labelPl: "Norma fizjologiczna",
      labelEn: "Normal",
      descPl: "Prawidłowa temperatura (37.5–39.0°C)",
      descEn: "Normal body temperature (37.5–39.0°C)",
      colorClass: "stage-normal",
    };
  }
  if (celsius <= 39.4) {
    return {
      status: "subfebrile",
      labelPl: "Stan podgorączkowy",
      labelEn: "Subfebrile",
      descPl: "Lekko podwyższona (39.1–39.4°C)",
      descEn: "Slightly elevated (39.1–39.4°C)",
      colorClass: "stage-borderline",
    };
  }
  return {
    status: "fever",
    labelPl: "Gorączka / Hipertermia",
    labelEn: "Fever / Hyperthermia",
    descPl: "Wysoka gorączka (≥ 39.5°C)",
    descEn: "High fever (≥ 39.5°C)",
    colorClass: "stage-severe",
  };
}
