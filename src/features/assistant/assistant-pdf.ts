import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AssistantPdfSummary } from "./types";

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_BRAND = rgb(0.086, 0.302, 0.204); // #164d34
const COLOR_BRAND_BG = rgb(0.933, 0.969, 0.949); // #eef7f2
const COLOR_BRAND_BORDER = rgb(0.812, 0.89, 0.847); // #cfe3d8
const COLOR_TEXT = rgb(0.11, 0.145, 0.137);
const COLOR_MUTED = rgb(0.322, 0.392, 0.384);
const COLOR_LINE = rgb(0.878, 0.863, 0.831);
const COLOR_WARN_BG = rgb(0.996, 0.973, 0.922);
const COLOR_WARN_BORDER = rgb(0.953, 0.831, 0.569);

let cachedAssets: {
  regular: Uint8Array;
  bold: Uint8Array;
  logoPng?: Uint8Array;
} | null = null;

async function loadBrowserPdfAssets(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
  logoPng?: Uint8Array;
}> {
  if (cachedAssets) return cachedAssets;
  const [regRes, boldRes, logoRes] = await Promise.all([
    fetch("/fonts/Inter-Regular.ttf"),
    fetch("/fonts/Inter-Bold.ttf"),
    fetch("/brand/icon-192.png").catch(() => null),
  ]);
  if (!regRes.ok || !boldRes.ok) {
    throw new Error("Nie udało się wczytać czcionek do wygenerowania pliku PDF.");
  }
  const [regBuf, boldBuf, logoBuf] = await Promise.all([
    regRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    logoRes?.ok ? logoRes.arrayBuffer() : Promise.resolve(null),
  ]);
  cachedAssets = {
    regular: new Uint8Array(regBuf),
    bold: new Uint8Array(boldBuf),
    logoPng: logoBuf ? new Uint8Array(logoBuf) : undefined,
  };
  return cachedAssets;
}

/** Strips characters unsupported by the embedded TTF font so pdf-lib never throws during text encoding. */
function safeTextForFont(font: PDFFont, raw: string, fontSize: number): string {
  const cleaned = raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  try {
    font.widthOfTextAtSize(cleaned, fontSize);
    return cleaned;
  } catch {
    let out = "";
    for (const ch of cleaned) {
      try {
        font.widthOfTextAtSize(ch, fontSize);
        out += ch;
      } catch {
        // Ignore unsupported emoji/symbol glyph
      }
    }
    return out.trim();
  }
}

/** Wraps a single paragraph into lines that fit inside maxWidth. */
function wrapText(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const safe = safeTextForFont(font, text, fontSize);
  if (!safe) return [];

  const words = safe.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      const candidate = chunk + ch;
      if (chunk && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
    } else {
      pushLongWord(word);
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function buildSummaryPdfFileName(
  petName: string,
  generatedAt: string,
): string {
  const slug = petName
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(generatedAt)
    ? generatedAt
    : new Date().toISOString().slice(0, 10);
  return `${slug || "pupil"}-wnioski-asystenta-${datePart}.pdf`;
}

export async function buildAssistantSummaryPdf(
  summary: AssistantPdfSummary,
  options?: {
    locale?: "pl" | "en";
    regularFontBytes?: Uint8Array;
    boldFontBytes?: Uint8Array;
    logoPngBytes?: Uint8Array;
  },
): Promise<Uint8Array> {
  const pl = options?.locale !== "en";
  const assets =
    options?.regularFontBytes && options?.boldFontBytes
      ? {
          regular: options.regularFontBytes,
          bold: options.boldFontBytes,
          logoPng: options.logoPngBytes,
        }
      : await loadBrowserPdfAssets();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(assets.regular);
  const boldFont = await pdfDoc.embedFont(assets.bold);
  const logoImage = assets.logoPng
    ? await pdfDoc.embedPng(assets.logoPng).catch(() => null)
    : null;

  pdfDoc.setTitle(summary.document_title || "Podsumowanie rozmowy Care My Pet");
  pdfDoc.setCreator("Care My Pet");

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const startNewPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN_TOP;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < MARGIN_BOTTOM) {
      startNewPage();
    }
  };

  // Top brand accent strip
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: COLOR_BRAND,
  });

  const brandHeader = pl
    ? "NOTATKA Z ROZMOWY Z ASYSTENTEM AI"
    : "AI ASSISTANT CONVERSATION SUMMARY";

  if (logoImage) {
    const logoSize = 32;
    page.drawImage(logoImage, {
      x: MARGIN_X,
      y: y - logoSize + 10,
      width: logoSize,
      height: logoSize,
    });
    const textX = MARGIN_X + logoSize + 10;
    page.drawText("Care My Pet", {
      x: textX,
      y: y - 3,
      size: 13,
      font: boldFont,
      color: COLOR_TEXT,
    });
    page.drawText(brandHeader, {
      x: textX,
      y: y - 16,
      size: 8,
      font: boldFont,
      color: COLOR_BRAND,
    });
    y -= logoSize + 8;
  } else {
    page.drawText(`CARE MY PET  •  ${brandHeader}`, {
      x: MARGIN_X,
      y,
      size: 8.5,
      font: boldFont,
      color: COLOR_BRAND,
    });
    y -= 20;
  }

  // Document title
  const titleLines = wrapText(
    boldFont,
    summary.document_title ||
      (pl ? `Wnioski z rozmowy — ${summary.pet_name}` : `Summary — ${summary.pet_name}`),
    16,
    CONTENT_WIDTH,
  );
  for (const line of titleLines) {
    ensureSpace(22);
    page.drawText(line, {
      x: MARGIN_X,
      y,
      size: 16,
      font: boldFont,
      color: COLOR_TEXT,
    });
    y -= 21;
  }
  y -= 6;

  // Pet & thread metadata box
  const speciesLabel =
    summary.species === "cat"
      ? pl
        ? "Kot"
        : "Cat"
      : pl
        ? "Pies"
        : "Dog";
  const metaRows: string[] = [
    `${pl ? "Pupil" : "Pet"}: ${summary.pet_name} (${speciesLabel}${summary.breed ? `, ${summary.breed}` : ""})`,
    `${pl ? "Data opracowania" : "Generated"}: ${summary.generated_at}${summary.birth_date ? `  •  ${pl ? "Ur." : "DOB"}: ${summary.birth_date}` : ""}${summary.latest_weight ? `  •  ${pl ? "Ostatnia waga" : "Latest weight"}: ${summary.latest_weight}` : ""}`,
  ];
  if (summary.thread_title) {
    metaRows.push(`${pl ? "Wątek" : "Thread"}: ${summary.thread_title}`);
  }

  const wrappedMeta = metaRows.flatMap((row) =>
    wrapText(regularFont, row, 9.5, CONTENT_WIDTH - 24),
  );
  const metaBoxHeight = wrappedMeta.length * 14 + 18;
  ensureSpace(metaBoxHeight + 12);

  page.drawRectangle({
    x: MARGIN_X,
    y: y - metaBoxHeight + 10,
    width: CONTENT_WIDTH,
    height: metaBoxHeight,
    color: COLOR_BRAND_BG,
    borderColor: COLOR_BRAND_BORDER,
    borderWidth: 1,
  });

  let metaY = y - 6;
  for (const line of wrappedMeta) {
    page.drawText(line, {
      x: MARGIN_X + 12,
      y: metaY,
      size: 9.5,
      font: regularFont,
      color: COLOR_TEXT,
    });
    metaY -= 14;
  }
  y -= metaBoxHeight + 10;

  const drawSectionHeading = (title: string) => {
    ensureSpace(34);
    y -= 6;
    page.drawText(safeTextForFont(boldFont, title, 11.5), {
      x: MARGIN_X,
      y,
      size: 11.5,
      font: boldFont,
      color: COLOR_BRAND,
    });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y },
      thickness: 0.75,
      color: COLOR_LINE,
    });
    y -= 14;
  };

  const drawParagraph = (text: string) => {
    const lines = wrapText(regularFont, text, 10, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(15);
      page.drawText(line, {
        x: MARGIN_X,
        y,
        size: 10,
        font: regularFont,
        color: COLOR_TEXT,
      });
      y -= 14.5;
    }
    y -= 4;
  };

  const drawListItems = (items: string[], numbered = false) => {
    items.forEach((item, index) => {
      const marker = numbered ? `${index + 1}.` : "•";
      const indent = numbered ? 18 : 14;
      const lines = wrapText(
        regularFont,
        item,
        10,
        CONTENT_WIDTH - indent,
      );
      if (lines.length === 0) return;

      ensureSpace(15);
      page.drawText(marker, {
        x: MARGIN_X + 2,
        y,
        size: 10,
        font: boldFont,
        color: COLOR_BRAND,
      });

      for (const line of lines) {
        ensureSpace(15);
        page.drawText(line, {
          x: MARGIN_X + indent,
          y,
          size: 10,
          font: regularFont,
          color: COLOR_TEXT,
        });
        y -= 14.5;
      }
      y -= 3;
    });
    y -= 2;
  };

  if (summary.executive_summary?.trim()) {
    drawSectionHeading(
      pl ? "Podsumowanie główne" : "Executive summary",
    );
    drawParagraph(summary.executive_summary);
  }

  if (summary.key_findings.length > 0) {
    drawSectionHeading(
      pl
        ? "Kluczowe obserwacje i wnioski z rozmowy"
        : "Key observations & takeaways",
    );
    drawListItems(summary.key_findings, false);
  }

  if (summary.observations_for_owner.length > 0) {
    drawSectionHeading(
      pl
        ? "Na co zwrócić uwagę w dalszej opiece"
        : "Care & monitoring notes",
    );
    drawListItems(summary.observations_for_owner, false);
  }

  if (summary.questions_for_vet.length > 0) {
    drawSectionHeading(
      pl
        ? "Sugerowane pytania do lekarza weterynarii"
        : "Suggested questions for your veterinarian",
    );
    drawListItems(summary.questions_for_vet, true);
  }

  if (summary.sources.length > 0) {
    drawSectionHeading(
      pl ? "Powiązane wpisy z kartoteki" : "Referenced record entries",
    );
    const sourceLines = summary.sources.map((src) => {
      const typeLabel =
        src.source_type === "medical_report"
          ? pl
            ? "Badanie"
            : "Report"
          : pl
            ? "Wpis historii"
            : "History";
      return `[${typeLabel}] ${src.title}${src.event_date ? ` (${src.event_date})` : ""}`;
    });
    drawListItems(sourceLines, false);
  }

  // Disclaimer box
  const disclaimerText = pl
    ? "Ważne: Niniejszy dokument został wygenerowany automatycznie przez Asystenta AI Care My Pet na podstawie rozmowy z opiekunem oraz zapisów w kartotece. Ma charakter wyłącznie pomocniczy i informacyjny — nie stanowi diagnozy medycznej, porady lekarsko-weterynaryjnej ani zlecenia dawkowania leków."
    : "Important: This document was automatically generated by Care My Pet AI Assistant from your conversation and saved records. It is for informational purposes only and does not replace veterinary consultation or medical diagnosis.";
  const disclaimerLines = wrapText(
    regularFont,
    disclaimerText,
    8.5,
    CONTENT_WIDTH - 20,
  );
  const boxH = disclaimerLines.length * 12 + 16;
  ensureSpace(boxH + 14);
  y -= 6;
  page.drawRectangle({
    x: MARGIN_X,
    y: y - boxH + 10,
    width: CONTENT_WIDTH,
    height: boxH,
    color: COLOR_WARN_BG,
    borderColor: COLOR_WARN_BORDER,
    borderWidth: 0.75,
  });
  let dy = y - 5;
  for (const line of disclaimerLines) {
    page.drawText(line, {
      x: MARGIN_X + 10,
      y: dy,
      size: 8.5,
      font: regularFont,
      color: COLOR_MUTED,
    });
    dy -= 12;
  }

  // Page numbers & footer
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const footerLeft = "Care My Pet  •  caremypet.pl";
    const footerRight = pl
      ? `Strona ${idx + 1} z ${totalPages}`
      : `Page ${idx + 1} of ${totalPages}`;
    p.drawText(footerLeft, {
      x: MARGIN_X,
      y: 26,
      size: 8,
      font: regularFont,
      color: COLOR_MUTED,
    });
    const rightWidth = regularFont.widthOfTextAtSize(footerRight, 8);
    p.drawText(footerRight, {
      x: PAGE_WIDTH - MARGIN_X - rightWidth,
      y: 26,
      size: 8,
      font: regularFont,
      color: COLOR_MUTED,
    });
  });

  return pdfDoc.save();
}

export async function downloadAssistantSummaryPdf(
  summary: AssistantPdfSummary,
  locale: "pl" | "en" = "pl",
): Promise<void> {
  const bytes = await buildAssistantSummaryPdf(summary, { locale });
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = buildSummaryPdfFileName(
      summary.pet_name,
      summary.generated_at,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
