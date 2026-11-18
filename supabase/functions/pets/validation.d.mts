export const MAX_PET_TAGS: number;
export const MAX_PET_TAG_LENGTH: number;
export function normalizePetTags(raw: unknown): string[];
export function validatePet(
  input: unknown,
  today?: string,
): {
  ok: boolean;
  field?: string;
  value?: {
    imie: string;
    gatunek: "cat" | "dog";
    rasa: string | null;
    data_urodzenia: string | null;
    plec: "female" | "male" | "unknown";
    kastracja: boolean | null;
    identyfikacja: "chip" | "tattoo" | "none" | "unknown";
    numer_id: string | null;
    notatki: string | null;
    tagi: string[];
    data_urodzenia_przyblizona: boolean;
    avatar_path: string | null;
  };
};

export type ArchiveReason = "deceased" | "rehomed" | "other";
export const ARCHIVE_REASONS: readonly ArchiveReason[];
export const MAX_ARCHIVE_NOTE_LENGTH: number;

export function validateArchivePet(
  input: unknown,
  today?: string,
  birthDate?: string | null,
): {
  ok: boolean;
  field?: string;
  value?: {
    archive_reason: ArchiveReason;
    closed_on: string | null;
    archive_note: string | null;
  };
};
