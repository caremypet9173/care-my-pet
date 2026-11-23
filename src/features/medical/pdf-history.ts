/**
 * Zarządzanie historią zaimportowanych stron plików PDF w localStorage.
 * Pozwala zapamiętać, które strony wielostronicowego wypisu zostały już
 * wcześniej wyekstrahowane dla danego pupila, zapobiegając duplikatom
 * i ułatwiając import kolejnych partii dokumentu.
 */

export interface ImportedRange {
  start: number;
  end: number;
  date: string;
}

export interface ImportedPdfHistory {
  sha256: string;
  fileName: string;
  importedRanges: ImportedRange[];
  allImportedPages: number[];
}

function getStorageKey(petId: string, sha256: string): string {
  return `cmp_pdf_history_${petId}_${sha256}`;
}

export function getPdfImportHistory(
  petId: string,
  sha256: string,
): ImportedPdfHistory | null {
  if (typeof window === "undefined" || !petId || !sha256) return null;

  try {
    const raw = localStorage.getItem(getStorageKey(petId, sha256));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportedPdfHistory;
    return parsed;
  } catch {
    return null;
  }
}

export function recordPdfImport(
  petId: string,
  sha256: string,
  fileName: string,
  start: number,
  end: number,
): ImportedPdfHistory | null {
  if (typeof window === "undefined" || !petId || !sha256) return null;

  try {
    const existing = getPdfImportHistory(petId, sha256);
    const newRange: ImportedRange = {
      start,
      end,
      date: new Date().toISOString(),
    };

    const ranges = existing ? [...existing.importedRanges, newRange] : [newRange];

    // Zbuduj unikalny zbiór wszystkich zaimportowanych stron
    const pageSet = new Set<number>(existing?.allImportedPages || []);
    for (let p = start; p <= end; p++) {
      pageSet.add(p);
    }
    const allPages = Array.from(pageSet).sort((a, b) => a - b);

    const updated: ImportedPdfHistory = {
      sha256,
      fileName,
      importedRanges: ranges,
      allImportedPages: allPages,
    };

    localStorage.setItem(getStorageKey(petId, sha256), JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

export function recordPdfImportPages(
  petId: string,
  sha256: string,
  fileName: string,
  pages: number[],
): ImportedPdfHistory | null {
  if (typeof window === "undefined" || !petId || !sha256) return null;
  if (!pages || pages.length === 0) return null;

  try {
    const existing = getPdfImportHistory(petId, sha256);
    const sorted = Array.from(new Set(pages.filter((p) => p > 0))).sort((a, b) => a - b);
    if (sorted.length === 0) return null;

    const newRange: ImportedRange = {
      start: sorted[0],
      end: sorted[sorted.length - 1],
      date: new Date().toISOString(),
    };

    const ranges = existing ? [...existing.importedRanges, newRange] : [newRange];
    const pageSet = new Set<number>(existing?.allImportedPages || []);
    sorted.forEach((p) => pageSet.add(p));
    const allPages = Array.from(pageSet).sort((a, b) => a - b);

    const updated: ImportedPdfHistory = {
      sha256,
      fileName,
      importedRanges: ranges,
      allImportedPages: allPages,
    };

    localStorage.setItem(getStorageKey(petId, sha256), JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

/**
 * Zwraca listę numerów stron sugerowanych do kolejnej tury importu.
 * Preferuje strony jeszcze niezaimportowane (do maksymalnie maxPages stron).
 */
export function getSuggestedNextPages(
  totalPages: number,
  history: ImportedPdfHistory | null,
  maxPages = 10,
): { pages: number[]; hasUnimported: boolean } {
  if (totalPages <= 0) {
    return { pages: [], hasUnimported: false };
  }

  const importedSet = new Set(history?.allImportedPages || []);
  const unimported: number[] = [];

  for (let p = 1; p <= totalPages; p++) {
    if (!importedSet.has(p)) {
      unimported.push(p);
      if (unimported.length >= maxPages) break;
    }
  }

  if (unimported.length > 0) {
    return { pages: unimported, hasUnimported: true };
  }

  // Wszystkie strony zostały już zaimportowane — nie sugerujemy automatycznie ponownego importu
  return { pages: [], hasUnimported: false };
}

/**
 * Wyznacza sugerowany kolejny zakres stron do zaimportowania na podstawie
 * dotychczasowej historii i maksymalnego limitu (10 stron).
 */
export function getSuggestedNextRange(
  totalPages: number,
  history: ImportedPdfHistory | null,
  maxPages = 10,
): { start: number; end: number; hasUnimported: boolean } {
  if (totalPages <= 0) {
    return { start: 1, end: 1, hasUnimported: false };
  }

  if (!history || history.allImportedPages.length === 0) {
    return {
      start: 1,
      end: Math.min(maxPages, totalPages),
      hasUnimported: true,
    };
  }

  const importedSet = new Set(history.allImportedPages);

  // Znajdź pierwszą stronę, która nie była jeszcze importowana
  let firstUnimported = 1;
  while (firstUnimported <= totalPages && importedSet.has(firstUnimported)) {
    firstUnimported++;
  }

  if (firstUnimported > totalPages) {
    // Wszystkie strony zostały już zaimportowane
    return { start: 1, end: Math.min(maxPages, totalPages), hasUnimported: false };
  }

  // Sugerowany koniec to min(pierwsza_niezaimportowana + maxPages - 1, totalPages)
  const suggestedEnd = Math.min(firstUnimported + maxPages - 1, totalPages);

  return {
    start: firstUnimported,
    end: suggestedEnd,
    hasUnimported: true,
  };
}
