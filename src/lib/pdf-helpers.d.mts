import type { PDFFont } from "pdf-lib";

export function loadBrowserPdfAssets(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
  logoPng?: Uint8Array;
}>;

export function safeTextForFont(
  font: PDFFont,
  raw: string,
  fontSize: number,
): string;

export function wrapText(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[];
