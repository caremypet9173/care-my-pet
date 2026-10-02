export type LabResult = {
  id: string;
  name: string;
  value: number;
  unit: string;
  reference: { min: number; max: number } | null;
  status: "within" | "above" | "below" | "unknown";
  category?: "renal" | "blood" | "liver";
  previous?: number;
};

export type LabReport = {
  title: string;
  date: string;
  source: string;
  results: readonly LabResult[];
};
