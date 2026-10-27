export type HealthEventCategory = 'visit' | 'vaccination' | 'prevention';

export type HealthEvent = {
  id: string;
  pet_id: string;
  household_id: string;
  category: HealthEventCategory;
  title: string;
  event_date: string;
  next_due_date: string | null;
  clinic: string;
  doctor: string;
  batch_or_product: string;
  description: string;
  source_path: string | null;
  source_name: string | null;
  source_mime: string | null;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};
