export type RecordEvent = {
  id: string;
  date: string;
  category: "visit" | "lab" | "vaccination" | "prevention";
  title: string;
  provider: string;
  description: string;
  documentId?: string;
  detail: string;
};
