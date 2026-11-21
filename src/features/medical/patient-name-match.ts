/**
 * Polish-diacritics-aware comparison between the patient name extracted from a
 * veterinary document and a pet's profile name.
 * Designed to avoid false positives on declensions ("Maniuś" vs "Maniusia",
 * "Luna, Kowalska" vs "Luna") while flagging distinct names ("Kruszyna" vs "Kruszek").
 */

export function normalizePetNameForCompare(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeName(raw: string): string[] {
  const normalized = normalizePetNameForCompare(raw);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter((token) => token.length >= 2);
}

function tokensCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  return false;
}

export function isPatientNameMismatch(
  extractedPatientName: string,
  petName: string,
): boolean {
  const docTokens = tokenizeName(extractedPatientName);
  const petTokens = tokenizeName(petName);
  if (docTokens.length === 0 || petTokens.length === 0) return false;

  for (const pt of petTokens) {
    for (const dt of docTokens) {
      if (tokensCompatible(pt, dt)) {
        return false;
      }
    }
  }
  return true;
}

export function findMatchingOtherPet<T extends { id: string; imie: string }>(
  extractedPatientName: string,
  otherPets: T[],
): T | null {
  if (!extractedPatientName.trim() || otherPets.length === 0) return null;
  for (const candidate of otherPets) {
    if (!isPatientNameMismatch(extractedPatientName, candidate.imie)) {
      return candidate;
    }
  }
  return null;
}
