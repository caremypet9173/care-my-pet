export type HealthEventCategory = "visit" | "vaccination" | "prevention";

export const MAX_FILE: number;
export const mimeExtensions: Record<string, string>;
export function fileMatches(bytes: Uint8Array, mime: string): boolean;
export function isValidIsoDate(date: unknown): boolean;

export type HealthEventInput = {
  category?: string;
  title?: string;
  event_date?: string;
  next_due_date?: string | null;
  clinic?: string;
  doctor?: string;
  batch_or_product?: string;
  description?: string;
};

export type ValidatedHealthEvent = {
  category: HealthEventCategory;
  title: string;
  event_date: string;
  next_due_date: string | null;
  clinic: string;
  doctor: string;
  batch_or_product: string;
  description: string;
};

export function today(): string;
export function validateHealthEvent(input: HealthEventInput): {
  errors: Partial<Record<keyof ValidatedHealthEvent, string>>;
  value: ValidatedHealthEvent | null;
};
