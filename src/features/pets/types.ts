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

export type ArchiveReason = "deceased" | "rehomed" | "other";

export type Pet = {
  id: string; gospodarstwo_id: string; imie: string; gatunek: "cat" | "dog";
  rasa: string | null; data_urodzenia: string | null; plec: "female" | "male" | "unknown";
  kastracja: boolean | null; identyfikacja: "chip" | "tattoo" | "none" | "unknown";
  numer_id: string | null; notatki: string | null; tagi?: string[]; updated_at: string;
  data_urodzenia_przyblizona: boolean; avatar_path: string | null; avatar_url?: string | null;
  report_count?: number;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: ArchiveReason | null;
  closed_on?: string | null;
  archive_note?: string | null;
};
