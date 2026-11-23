import { PDFDocument } from "pdf-lib";

export const MAX_DISCHARGE_PAGES = 10;

export interface PdfInfo {
  pageCount: number;
  byteSize: number;
  name: string;
}

export interface PageChunk {
  id: string;
  label: string;
  start: number; // 1-indexed inclusive
  end: number;   // 1-indexed inclusive
  pageCount: number;
}

/**
 * Odczytuje metadane pliku PDF (liczbę stron i poprawność struktury).
 */
export async function inspectPdf(file: File | Blob): Promise<PdfInfo> {
  const buffer = await file.arrayBuffer();
  // ignoreEncryption allows reading unencrypted/open PDFs that have standard security flags
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  if (pageCount < 1) {
    throw new Error("Plik PDF nie zawiera żadnych stron.");
  }

  return {
    pageCount,
    byteSize: file.size,
    name: file instanceof File ? file.name : "dokument.pdf",
  };
}

/**
 * Dzieli plik PDF na logiczne paczki o maksymalnym rozmiarze chunkSize (domyślnie 20).
 */
export function computePageChunks(
  totalPages: number,
  chunkSize = MAX_DISCHARGE_PAGES,
): PageChunk[] {
  if (totalPages <= 0) return [];
  const chunks: PageChunk[] = [];
  let part = 1;

  for (let start = 1; start <= totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalPages);
    const count = end - start + 1;
    const label =
      totalPages <= chunkSize
        ? `Wszystkie strony (1–${totalPages})`
        : `Część ${part} (strony ${start}–${end})`;

    chunks.push({
      id: `chunk_${start}_${end}`,
      label,
      start,
      end,
      pageCount: count,
    });
    part++;
  }

  return chunks;
}

/**
 * Wyodrębnia wybrany podzakres stron [startPage, endPage] (indeksy 1-based inclusive).
 * Jeśli zakres obejmuje cały oryginalny dokument, zwraca oryginalny plik bez rekompresji.
 */
export async function slicePdfPages(
  file: File,
  startPage: number,
  endPage: number,
): Promise<File> {
  if (startPage < 1) {
    throw new Error("Początkowa strona nie może być mniejsza niż 1.");
  }
  if (endPage < startPage) {
    throw new Error("Strona końcowa nie może być mniejsza niż początkowa.");
  }
  const count = endPage - startPage + 1;
  if (count > MAX_DISCHARGE_PAGES) {
    throw new Error(
      `Zakres obejmuje ${count} stron. Maksymalny dopuszczalny limit to ${MAX_DISCHARGE_PAGES} stron na jedną ekstrakcję.`,
    );
  }

  const buffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (endPage > totalPages) {
    throw new Error(
      `Wybrany zakres (do strony ${endPage}) przekracza liczbę stron w dokumencie (${totalPages}).`,
    );
  }

  // Jeśli użytkownik wybrał cały dokument od 1 do totalPages, zachowaj oryginał
  if (startPage === 1 && endPage === totalPages) {
    return file;
  }

  const subDoc = await PDFDocument.create();
  // 0-indexed page indices for pdf-lib
  const pageIndices: number[] = [];
  for (let p = startPage; p <= endPage; p++) {
    pageIndices.push(p - 1);
  }

  const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((page) => subDoc.addPage(page));

  const slicedBytes = await subDoc.save();

  const originalBase = file.name.replace(/\.pdf$/i, "");
  const slicedName = `${originalBase}_strony_${startPage}-${endPage}.pdf`;

  return new File([slicedBytes as unknown as BlobPart], slicedName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

/**
 * Wyodrębnia dowolny zbiór wybranych pojedynczych stron (indeksy 1-based).
 * Strony są sortowane rosnąco i deduplikowane.
 * Maksymalna dozwolona liczba stron to MAX_DISCHARGE_PAGES (10).
 */
export async function sliceSelectedPdfPages(
  file: File,
  selectedPages: number[],
): Promise<File> {
  const uniquePages = Array.from(
    new Set(
      selectedPages
        .map((p) => Math.floor(Number(p)))
        .filter((p) => !Number.isNaN(p) && p > 0),
    ),
  ).sort((a, b) => a - b);

  if (uniquePages.length === 0) {
    throw new Error("Wybierz przynajmniej jedną stronę do analizy.");
  }

  if (uniquePages.length > MAX_DISCHARGE_PAGES) {
    throw new Error(
      `Wybrano ${uniquePages.length} stron. Maksymalny dopuszczalny limit to ${MAX_DISCHARGE_PAGES} stron na jedną analizę.`,
    );
  }

  const buffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  for (const pageNum of uniquePages) {
    if (pageNum > totalPages) {
      throw new Error(
        `Wybrana strona (${pageNum}) przekracza liczbę stron w dokumencie (${totalPages}).`,
      );
    }
  }

  // Jeśli wybrano dokładnie wszystkie strony od 1 do totalPages
  if (
    uniquePages.length === totalPages &&
    uniquePages[0] === 1 &&
    uniquePages[uniquePages.length - 1] === totalPages
  ) {
    return file;
  }

  const subDoc = await PDFDocument.create();
  const pageIndices = uniquePages.map((p) => p - 1);
  const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((page) => subDoc.addPage(page));

  const slicedBytes = await subDoc.save();

  const originalBase = file.name.replace(/\.pdf$/i, "");
  const pagesSummary =
    uniquePages.length <= 4
      ? uniquePages.join("_")
      : `${uniquePages[0]}-${uniquePages[uniquePages.length - 1]}_${uniquePages.length}str`;
  const slicedName = `${originalBase}_wybrane_${pagesSummary}.pdf`;

  return new File([slicedBytes as unknown as BlobPart], slicedName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}
