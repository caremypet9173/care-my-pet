/**
 * Dependency-free PDF page counter for Edge runtime.
 * Inspects PDF structure to count leaf /Type /Page objects with /Pages /Count fallback.
 */
export function countPdfPages(bytes: Uint8Array): number {
  try {
    const text = new TextDecoder('latin1').decode(bytes);
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
    const countMatch = text.match(/\/Type\s*\/Pages[\s\S]{1,300}?\/Count\s+(\d+)/);
    if (countMatch) {
      const parsed = parseInt(countMatch[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    return 1;
  } catch {
    return 1;
  }
}
