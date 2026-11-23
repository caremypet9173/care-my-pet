export type PetDocument = {
  id: string;
  title: string;
  date: string;
  category: "lab" | "visit" | "vaccination" | "invoice";
  label: string;
  source: string;
  paragraphs: readonly string[];
  relatedEventId?: string;
};
