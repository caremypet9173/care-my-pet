const HH_MM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function todayWarsawIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

export function addIsoDays(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  if (!y || !m || !d) return baseIso;
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function normalizeScheduledTimes(times: string[]): string[] {
  return Array.from(
    new Set(times.map((t) => t.trim()).filter((t) => HH_MM_RE.test(t))),
  ).sort();
}

export function nextTimeSlotSuggestion(existing: string[]): string {
  const last = existing[existing.length - 1] || "08:00";
  const [h = 8, m = 0] = last.split(":").map(Number);
  const nextH = (h + 8) % 24;
  return `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildFluidScheduleInstructions(params: {
  medicationsAdded?: string;
  notes?: string;
  clinicName?: string;
  doctorName?: string;
  catheterStatus?: string;
}): string {
  const parts: string[] = [];
  const meds = params.medicationsAdded?.trim();
  const notes = params.notes?.trim();
  const clinic = params.clinicName?.trim();
  const doctor = params.doctorName?.trim();
  const catheter = params.catheterStatus?.trim();

  if (meds) parts.push(meds);
  if (catheter) parts.push(`Wkłucie: ${catheter}`);
  if (clinic) {
    parts.push(doctor ? `Lecznica: ${clinic} (${doctor})` : `Lecznica: ${clinic}`);
  }
  if (notes) parts.push(notes);

  return parts.join(" · ").slice(0, 2000);
}

/**
 * Dzieli tekst z listą leków lub dodatków we wlewie na znormalizowane, unikalne chipsy.
 */
export function parseMedicationChips(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const chips: string[] = [];

  for (const part of raw.split(/[,;\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push(trimmed);
  }

  return chips;
}

/**
 * Scala tablicę chipsów leków w jeden czytelny ciąg oddzielony przecinkami.
 */
export function formatMedicationChips(chips: string[]): string {
  return parseMedicationChips(chips.join(",")).join(", ");
}
