export type HealthEventCategory = "visit" | "vaccination" | "prevention";

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
