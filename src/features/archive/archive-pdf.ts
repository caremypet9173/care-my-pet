import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  loadBrowserPdfAssets,
  safeTextForFont,
  wrapText,
} from "../../lib/pdf-helpers.mjs";
import type { PetArchivePayload } from "./types";

function parseNum(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function getParamRangeStatus(
  valueRaw: string,
  refRaw: string,
): "within" | "above" | "below" | "unknown" {
  const v = parseNum(valueRaw);
  const m = refRaw.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (v === null || !m) return "unknown";
  const min = parseNum(m[1]);
  const max = parseNum(m[2]);
  if (min === null || max === null || min >= max) return "unknown";
  if (v < min) return "below";
  if (v > max) return "above";
  return "within";
}

const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 46;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_BRAND = rgb(0.086, 0.302, 0.204);
const COLOR_BRAND_BG = rgb(0.933, 0.969, 0.949);
const COLOR_BRAND_BORDER = rgb(0.812, 0.89, 0.847);
const COLOR_TEXT = rgb(0.11, 0.145, 0.137);
const COLOR_MUTED = rgb(0.322, 0.392, 0.384);
const COLOR_LINE = rgb(0.878, 0.863, 0.831);
const COLOR_ROW_ALT = rgb(0.98, 0.973, 0.957);
const COLOR_ALERT = rgb(0.659, 0.141, 0.141);

export function buildArchivePdfFileName(
  petName: string,
  generatedAtIso: string,
): string {
  const slug = petName
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const datePart = /^\d{4}-\d{2}-\d{2}/.test(generatedAtIso)
    ? generatedAtIso.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `${slug || "pupil"}-archiwum-kartoteki-${datePart}.pdf`;
}

function formatDateLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.slice(0, 10);
}

export async function buildPetArchivePdf(
  payload: PetArchivePayload,
  options?: {
    locale?: "pl" | "en";
    generatedAt?: string;
    regularFontBytes?: Uint8Array;
    boldFontBytes?: Uint8Array;
    logoPngBytes?: Uint8Array;
  },
): Promise<Uint8Array> {
  const pl = options?.locale !== "en";
  const generatedIso = (options?.generatedAt || new Date().toISOString()).slice(0, 10);

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

  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (assets.logoPng) {
    try {
      logoImage = await pdfDoc.embedPng(assets.logoPng);
    } catch {
      logoImage = null;
    }
  }

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN_TOP;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < MARGIN_BOTTOM) {
      newPage();
    }
  };

  const drawText = (
    text: string,
    opts: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      lineHeight?: number;
      maxWidth?: number;
    } = {},
  ) => {
    const size = opts.size ?? 9.5;
    const lineHeight = opts.lineHeight ?? Math.round(size * 1.45);
    const font: PDFFont = opts.bold ? boldFont : regularFont;
    const x = opts.x ?? MARGIN_X;
    const maxW = opts.maxWidth ?? PAGE_WIDTH - MARGIN_X - x;
    const lines = wrapText(font, text, size, maxW);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color: opts.color ?? COLOR_TEXT,
      });
      y -= lineHeight;
    }
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(32);
    y -= 6;
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 5,
      width: CONTENT_WIDTH,
      height: 20,
      color: COLOR_BRAND_BG,
      borderColor: COLOR_BRAND_BORDER,
      borderWidth: 0.6,
    });
    const safeTitle = safeTextForFont(boldFont, title, 10.5);
    page.drawText(safeTitle, {
      x: MARGIN_X + 8,
      y: y,
      size: 10.5,
      font: boldFont,
      color: COLOR_BRAND,
    });
    y -= 24;
  };

  const drawRule = () => {
    ensureSpace(10);
    page.drawLine({
      start: { x: MARGIN_X, y: y + 4 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: y + 4 },
      thickness: 0.6,
      color: COLOR_LINE,
    });
    y -= 8;
  };

  const { pet } = payload;

  // Nagłówek dokumentu
  if (logoImage) {
    page.drawImage(logoImage, {
      x: MARGIN_X,
      y: y - 16,
      width: 24,
      height: 24,
    });
  }

  const brandX = logoImage ? MARGIN_X + 32 : MARGIN_X;
  page.drawText("Care My Pet", {
    x: brandX,
    y: y - 2,
    size: 13,
    font: boldFont,
    color: COLOR_BRAND,
  });
  page.drawText(
    safeTextForFont(
      regularFont,
      pl ? "Archiwum kartoteki zdrowia zwierzaka" : "Digital Pet Health Record Archive",
      9,
    ),
    {
      x: brandX,
      y: y - 14,
      size: 9,
      font: regularFont,
      color: COLOR_MUTED,
    },
  );

  const metaRight = safeTextForFont(
    regularFont,
    `${pl ? "Wygenerowano" : "Generated"}: ${generatedIso}`,
    8.5,
  );
  const metaRightW = regularFont.widthOfTextAtSize(metaRight, 8.5);
  page.drawText(metaRight, {
    x: PAGE_WIDTH - MARGIN_X - metaRightW,
    y: y - 4,
    size: 8.5,
    font: regularFont,
    color: COLOR_MUTED,
  });

  y -= 34;

  const titleText = safeTextForFont(
    boldFont,
    `${pl ? "Kartoteka:" : "Record:"} ${pet.imie}`,
    16,
  );
  page.drawText(titleText, {
    x: MARGIN_X,
    y,
    size: 16,
    font: boldFont,
    color: COLOR_TEXT,
  });
  y -= 18;
  drawRule();

  // 1. Metryka pupila
  drawSectionHeading(pl ? "1. Profil i dane identyfikacyjne" : "1. Pet profile");
  const speciesLabel =
    pet.gatunek === "cat" ? (pl ? "Kot" : "Cat") : pl ? "Pies" : "Dog";
  const sexLabel =
    pet.plec === "female"
      ? pl
        ? "Samica"
        : "Female"
      : pet.plec === "male"
        ? pl
          ? "Samiec"
          : "Male"
        : pl
          ? "Nieznana"
          : "Unknown";
  const neuteredLabel =
    pet.kastracja === null
      ? pl
        ? "Nieznana"
        : "Unknown"
      : pet.kastracja
        ? pl
          ? "Tak"
          : "Yes"
        : pl
          ? "Nie"
          : "No";
  const idLabel =
    pet.identyfikacja === "chip"
      ? `Mikroczip${pet.numer_id ? `: ${pet.numer_id}` : ""}`
      : pet.identyfikacja === "tattoo"
        ? `Tatuaż${pet.numer_id ? `: ${pet.numer_id}` : ""}`
        : pet.identyfikacja === "none"
          ? pl
            ? "Brak"
            : "None"
          : pl
            ? "Nieznana"
            : "Unknown";

  drawText(
    `${pl ? "Gatunek" : "Species"}: ${speciesLabel}   |   ${pl ? "Rasa" : "Breed"}: ${pet.rasa || "—"}`,
  );
  drawText(
    `${pl ? "Data urodzenia" : "Birth date"}: ${pet.data_urodzenia ? `${pet.data_urodzenia}${pet.data_urodzenia_przyblizona ? (pl ? " (przybliżona)" : " (approx.)") : ""}` : "—"}   |   ${pl ? "Płeć" : "Sex"}: ${sexLabel}`,
  );
  drawText(
    `${pl ? "Kastracja / sterylizacja" : "Neutered"}: ${neuteredLabel}   |   ${pl ? "Identyfikacja" : "ID"}: ${idLabel}`,
  );

  if (pet.archived_at) {
    const reasonText =
      pet.archive_reason === "deceased"
        ? pl
          ? `W pamięci (pupil odszedł${pet.closed_on ? `: ${pet.closed_on}` : ""})`
          : `In memory (passed away${pet.closed_on ? `: ${pet.closed_on}` : ""})`
        : pet.archive_reason === "rehomed"
          ? pl
            ? "Kartoteka zamknięta (zmiana opiekuna)"
            : "Record closed (rehomed)"
          : pl
            ? "Kartoteka zamknięta"
            : "Record closed";
    drawText(`${pl ? "Status kartoteki" : "Status"}: ${reasonText}`, { bold: true });
  }

  if (Array.isArray(pet.tagi) && pet.tagi.length > 0) {
    drawText(`${pl ? "Tagi opiekuńcze" : "Care tags"}: ${pet.tagi.join(", ")}`);
  }

  if (pet.notatki) {
    drawText(`${pl ? "Notatka opiekuna" : "Guardian note"}: ${pet.notatki}`, {
      color: COLOR_MUTED,
    });
  }

  drawText(
    `${pl ? "Zakres archiwum" : "Archive summary"}: ${payload.reports.length} ${pl ? "badań" : "reports"}, ${payload.health_events.length} ${pl ? "zdarzeń" : "events"}, ${payload.weights.length} ${pl ? "pomiarów wagi" : "weights"}, ${payload.vital_measurements.length} ${pl ? "parametrów życiowych" : "vitals"}, ${payload.fluid_therapies.length} ${pl ? "sesji płynoterapii" : "fluid sessions"}, ${payload.attachments.length} ${pl ? "załączonych plików" : "attached files"}.`,
    { size: 8.5, color: COLOR_MUTED },
  );

  // 2. Masa ciała i parametry życiowe
  if (payload.weights.length > 0 || payload.vital_measurements.length > 0) {
    drawSectionHeading(
      pl ? "2. Masa ciała i parametry życiowe" : "2. Weight & vital measurements",
    );

    if (payload.weights.length > 0) {
      drawText(pl ? "Pomiary masy ciała:" : "Weight history:", { bold: true });
      for (const w of payload.weights) {
        drawText(
          `• ${formatDateLabel(w.measured_on)} — ${w.kg} kg${w.note ? ` (${w.note})` : ""}`,
          { x: MARGIN_X + 8, size: 9 },
        );
      }
    }

    if (payload.vital_measurements.length > 0) {
      y -= 3;
      drawText(pl ? "Parametry życiowe:" : "Vital signs:", { bold: true });
      for (const v of payload.vital_measurements) {
        const typeLabel =
          v.metric_type === "blood_pressure"
            ? pl
              ? "Ciśnienie"
              : "Blood pressure"
            : v.metric_type === "glucose"
              ? pl
                ? "Glukoza"
                : "Glucose"
              : pl
                ? "Temperatura"
                : "Temperature";
        const valText =
          v.metric_type === "blood_pressure"
            ? `${Math.round(v.value_primary)}${v.value_secondary ? `/${Math.round(v.value_secondary)}` : ""} mmHg${v.value_tertiary ? ` (HR ${Math.round(v.value_tertiary)} bpm)` : ""}`
            : v.metric_type === "glucose"
              ? `${Math.round(v.value_primary)} ${v.unit || "mg/dL"}`
              : `${v.value_primary.toFixed(1)} ${v.unit || "°C"}`;
        const timePart = v.measured_at
          ? ` ${new Date(v.measured_at).toISOString().slice(11, 16)}`
          : "";
        drawText(
          `• ${formatDateLabel(v.measured_on)}${timePart} — ${typeLabel}: ${valText}${v.context ? ` [${v.context}]` : ""}${v.note ? ` · ${v.note}` : ""}`,
          { x: MARGIN_X + 8, size: 9 },
        );
      }
    }
  }

  // 3. Leki i harmonogramy
  if (payload.medication_schedules.length > 0) {
    drawSectionHeading(
      pl ? "3. Leki i harmonogramy opieki" : "3. Medications & care schedules",
    );
    for (const m of payload.medication_schedules) {
      const title =
        m.schedule_category === "fluid_therapy"
          ? `${m.fluid_name || m.name}${m.fluid_volume_ml ? ` (${m.fluid_volume_ml} ml)` : ""}`
          : m.name;
      const times = Array.isArray(m.scheduled_times) && m.scheduled_times.length > 0
        ? m.scheduled_times.join(", ")
        : m.scheduled_time || "";
      const period = `${formatDateLabel(m.start_date)}${m.end_date ? ` -> ${formatDateLabel(m.end_date)}` : ""}`;
      const status = m.is_active
        ? pl
          ? "aktywny"
          : "active"
        : pl
          ? "zakończony / wstrzymany"
          : "inactive";
      drawText(
        `• ${title}${m.dosage ? ` — ${m.dosage}` : ""} [${status}]`,
        { bold: true, size: 9.5 },
      );
      drawText(
        `  ${pl ? "Okres" : "Period"}: ${period}${times ? ` | ${pl ? "Pory" : "Times"}: ${times}` : ""}${m.instructions ? ` | ${m.instructions}` : ""}`,
        { x: MARGIN_X + 8, size: 8.5, color: COLOR_MUTED },
      );
    }
  }

  // 4. Historia zdrowia i płynoterapia
  if (payload.health_events.length > 0 || payload.fluid_therapies.length > 0) {
    drawSectionHeading(
      pl ? "4. Historia zdrowia i płynoterapia" : "4. Health timeline & fluid therapy",
    );

    const catLabel = (c: string) => {
      if (c === "visit") return pl ? "Wizyta" : "Visit";
      if (c === "vaccination") return pl ? "Szczepienie" : "Vaccination";
      if (c === "prevention") return pl ? "Profilaktyka" : "Prevention";
      return pl ? "Zdarzenie" : "Event";
    };

    for (const ev of payload.health_events) {
      const meta = [
        ev.clinic,
        ev.doctor,
        ev.batch_or_product,
        ev.next_due_date ? `${pl ? "następny termin" : "next due"}: ${ev.next_due_date}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      drawText(
        `• ${formatDateLabel(ev.event_date)} [${catLabel(ev.category)}] ${ev.title}`,
        { bold: true, size: 9.5 },
      );
      if (meta) {
        drawText(meta, { x: MARGIN_X + 10, size: 8.5, color: COLOR_MUTED });
      }
      if (ev.description) {
        drawText(ev.description, { x: MARGIN_X + 10, size: 8.8 });
      }
      if (ev.source_name) {
        drawText(`${pl ? "Załącznik" : "Attachment"}: ${ev.source_name}`, {
          x: MARGIN_X + 10,
          size: 8.2,
          color: COLOR_BRAND,
        });
      }
    }

    if (payload.fluid_therapies.length > 0) {
      y -= 4;
      drawText(pl ? "Wykonane sesje płynoterapii:" : "Administered fluid therapy:", {
        bold: true,
      });
      for (const fl of payload.fluid_therapies) {
        drawText(
          `• ${formatDateLabel(fl.administered_on)} — ${fl.fluid_name} (${fl.volume_ml} ml, ${fl.route.toUpperCase()}, ${fl.location === "clinic" ? (pl ? "gabinet" : "clinic") : pl ? "dom" : "home"})${fl.medications_added ? ` | ${fl.medications_added}` : ""}`,
          { x: MARGIN_X + 8, size: 9 },
        );
        if (fl.notes) {
          drawText(fl.notes, { x: MARGIN_X + 16, size: 8.4, color: COLOR_MUTED });
        }
      }
    }
  }

  // 5. Wyniki badań laboratoryjnych i opisowych
  if (payload.reports.length > 0) {
    drawSectionHeading(
      pl ? "5. Wyniki badań laboratoryjnych i obrazowych" : "5. Lab & imaging reports",
    );

    payload.reports.forEach((rep, idx) => {
      ensureSpace(46);
      const repMeta = [rep.laboratory, rep.doctor, rep.source_name].filter(Boolean).join(" · ");
      drawText(
        `${idx + 1}. ${formatDateLabel(rep.test_date)} — ${rep.title}`,
        { bold: true, size: 10, color: COLOR_BRAND },
      );
      if (repMeta) {
        drawText(repMeta, { x: MARGIN_X + 8, size: 8.5, color: COLOR_MUTED });
      }

      if (rep.rows.length > 0) {
        y -= 2;
        rep.rows.forEach((row, rowIdx) => {
          const st = getParamRangeStatus(row.value, row.reference);
          const flag =
            st === "above"
              ? " [↑]"
              : st === "below"
                ? " [↓]"
                : "";
          const rowText = `${row.name}: ${row.value}${row.unit ? ` ${row.unit}` : ""}${flag}${row.reference ? `  (${pl ? "norma" : "ref"}: ${row.reference})` : ""}${row.note ? `  — ${row.note}` : ""}`;
          const lines = wrapText(regularFont, rowText, 8.6, CONTENT_WIDTH - 16);
          const blockH = lines.length * 12 + 2;
          ensureSpace(blockH);
          if (rowIdx % 2 === 1) {
            page.drawRectangle({
              x: MARGIN_X + 4,
              y: y - blockH + 10,
              width: CONTENT_WIDTH - 8,
              height: blockH,
              color: COLOR_ROW_ALT,
            });
          }
          for (const line of lines) {
            page.drawText(line, {
              x: MARGIN_X + 8,
              y,
              size: 8.6,
              font: st === "above" || st === "below" ? boldFont : regularFont,
              color: st === "above" || st === "below" ? COLOR_ALERT : COLOR_TEXT,
            });
            y -= 12;
          }
        });
      }

      if (rep.notes) {
        y -= 2;
        drawText(`${pl ? "Opis / uwagi" : "Notes"}: ${rep.notes}`, {
          x: MARGIN_X + 8,
          size: 8.8,
        });
      }
      if (rep.ai_interpretation) {
        drawText(
          `${pl ? "Podsumowanie badania (AI)" : "Report AI summary"}: ${rep.ai_interpretation}`,
          {
            x: MARGIN_X + 8,
            size: 8.5,
            color: COLOR_MUTED,
          },
        );
      }
      y -= 6;
    });
  }

  // 6. Wykaz oryginalnych plików badań
  if (payload.attachments.length > 0) {
    drawSectionHeading(
      pl ? "6. Wykaz oryginalnych dokumentów źródłowych" : "6. Original attached files",
    );
    drawText(
      pl
        ? "Oryginalne pliki PDF / JPG / PNG są dostępne do pobrania pod tym samym linkiem archiwum w okresie jego ważności."
        : "Original PDF / JPG / PNG files can be downloaded directly from the archive link while it remains active.",
      { size: 8.5, color: COLOR_MUTED },
    );
    for (const att of payload.attachments) {
      drawText(
        `• ${formatDateLabel(att.date)} — ${att.source_name}${att.title ? ` (${att.title})` : ""}`,
        { x: MARGIN_X + 8, size: 8.8 },
      );
    }
  }

  // Stopka z numeracją stron
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const footerLeft = "Care My Pet  •  caremypet.pl";
    const footerRight = pl
      ? `Strona ${idx + 1} z ${totalPages}`
      : `Page ${idx + 1} of ${totalPages}`;
    p.drawText(footerLeft, {
      x: MARGIN_X,
      y: 24,
      size: 8,
      font: regularFont,
      color: COLOR_MUTED,
    });
    const rightWidth = regularFont.widthOfTextAtSize(footerRight, 8);
    p.drawText(footerRight, {
      x: PAGE_WIDTH - MARGIN_X - rightWidth,
      y: 24,
      size: 8,
      font: regularFont,
      color: COLOR_MUTED,
    });
  });

  return pdfDoc.save();
}

export async function downloadPetArchivePdf(
  payload: PetArchivePayload,
  locale: "pl" | "en" = "pl",
): Promise<void> {
  const bytes = await buildPetArchivePdf(payload, { locale });
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = buildArchivePdfFileName(
      payload.pet.imie,
      new Date().toISOString().slice(0, 10),
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
