import { PDFDocument } from 'npm:pdf-lib@1.17.1';

export const MAX_PDF_PAGES = 10;

export class UnreadablePdfError extends Error {
  constructor(message = 'unreadable_pdf') {
    super(message);
    this.name = 'UnreadablePdfError';
  }
}

/**
 * Counts pages in a PDF using pdf-lib (handles PDF 1.5+ compressed /ObjStm object streams).
 * Falls back to structural regex inspection ONLY for legacy non-/ObjStm PDFs; fails closed
 * when a PDF uses compressed object streams that cannot be parsed.
 */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const count = doc.getPageCount();
    if (Number.isInteger(count) && count > 0) {
      return count;
    }
  } catch {
    // Fall through to legacy inspection only when no compressed object streams exist
  }

  const text = new TextDecoder('latin1').decode(bytes);
  if (/\/ObjStm\b/.test(text)) {
    throw new UnreadablePdfError();
  }

  const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
  if (pageMatches && pageMatches.length > 0) {
    return pageMatches.length;
  }

  const countMatches = Array.from(text.matchAll(/\/Type\s*\/Pages[\s\S]{1,300}?\/Count\s+(\d+)/g));
  let maxCount = 0;
  for (const match of countMatches) {
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > maxCount) {
      maxCount = parsed;
    }
  }
  if (maxCount > 0) {
    return maxCount;
  }

  throw new UnreadablePdfError();
}
