import type { LabReport } from "@/features/lab-results/types";

export type PetProfile = {
  name: string;
  historyLabel: string;
  weightStatus: string;
  description: string;
  image: string;
  weightKg: number;
  weights: readonly { date: string; kg: number }[];
  appointment: {
    date: string;
    title: string;
    note: string;
    previousDate: string;
    summary: string;
  };
  report: LabReport;
};
