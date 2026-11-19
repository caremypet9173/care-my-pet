import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import {
  loadBrowserPdfAssets,
  safeTextForFont,
  wrapText,
} from "../../lib/pdf-helpers.mjs";

export function buildRecoveryQrUrl(params: {
  recoveryUrl: string;
  ownerEmail?: string | null;
  recoveryKey: string;
}): string {
  const base = params.recoveryUrl.split("#")[0];
  const hashParams = new URLSearchParams();
  const trimmedOwner = params.ownerEmail?.trim();
  if (trimmedOwner) {
    hashParams.set("owner", trimmedOwner);
  }
  hashParams.set("key", params.recoveryKey.trim());
  return `${base}#${hashParams.toString()}`;
}

export interface RecoveryKeyPdfInput {
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  recoveryKey: string;
  keyHint: string;
  createdAtIso: string;
  recoveryUrl: string;
  locale: "pl" | "en";
}

export interface RecoveryKeyPdfAssets {
  regular: Uint8Array;
  bold: Uint8Array;
  logoPng?: Uint8Array;
}

export async function buildRecoveryKeyPdfWithAssets(
  input: RecoveryKeyPdfInput,
  assets: RecoveryKeyPdfAssets,
): Promise<Uint8Array> {
  const pl = input.locale === "pl";
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(
    pl
      ? `Klucz odzyskania Care My Pet — ${input.householdName}`
      : `Care My Pet Recovery Key — ${input.householdName}`,
  );
  pdfDoc.setCreator("Care My Pet");

  const regularFont = await pdfDoc.embedFont(assets.regular);
  const boldFont = await pdfDoc.embedFont(assets.bold);

  const pageWidth = 595.28; // A4 pt
  const pageHeight = 841.89;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  const brandGreen = rgb(0.086, 0.302, 0.204);
  const creamBg = rgb(0.984, 0.976, 0.957);
  const borderColor = rgb(0.84, 0.87, 0.85);
  const darkText = rgb(0.11, 0.14, 0.12);
  const mutedText = rgb(0.36, 0.42, 0.39);
  const keyBg = rgb(0.94, 0.97, 0.95);
  const warnBg = rgb(1.0, 0.97, 0.92);
  const warnBorder = rgb(0.89, 0.67, 0.32);

  // Header card
  page.drawRectangle({
    x: 0,
    y: pageHeight - 120,
    width: pageWidth,
    height: 120,
    color: brandGreen,
  });

  if (assets.logoPng) {
    try {
      const logoImg = await pdfDoc.embedPng(assets.logoPng);
      page.drawImage(logoImg, {
        x: margin,
        y: pageHeight - 86,
        width: 44,
        height: 44,
      });
    } catch {
      // Ignore logo decode failures
    }
  }

  const titleX = assets.logoPng ? margin + 58 : margin;
  page.drawText(safeTextForFont(boldFont, "Care My Pet", 18), {
    x: titleX,
    y: pageHeight - 56,
    size: 18,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safeTextForFont(
      regularFont,
      pl
        ? "Karta jednorazowego klucza odzyskania dostępu (Emergency Recovery Key)"
        : "One-Time Emergency Recovery Key Card",
      11,
    ),
    {
      x: titleX,
      y: pageHeight - 78,
      size: 11,
      font: regularFont,
      color: rgb(0.87, 0.94, 0.9),
    },
  );

  let y = pageHeight - 144;

  // Main key box + QR code (right column)
  const keyBoxHeight = 120;
  page.drawRectangle({
    x: margin,
    y: y - keyBoxHeight,
    width: contentWidth,
    height: keyBoxHeight,
    color: keyBg,
    borderColor: brandGreen,
    borderWidth: 1.5,
  });

  const qrOuterSize = 98;
  const qrPadding = 6;
  const qrX = margin + contentWidth - qrOuterSize - 12;
  const qrY = y - (keyBoxHeight + qrOuterSize) / 2;

  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrOuterSize,
    height: qrOuterSize,
    color: rgb(1, 1, 1),
    borderColor,
    borderWidth: 1,
  });

  const qrUrl = buildRecoveryQrUrl({
    recoveryUrl: input.recoveryUrl,
    ownerEmail: input.ownerEmail,
    recoveryKey: input.recoveryKey,
  });
  const qrMatrix = QRCode.create(qrUrl, { errorCorrectionLevel: "M" }).modules;
  const qrInnerSize = qrOuterSize - qrPadding * 2;
  const cellSize = qrInnerSize / qrMatrix.size;
  const qrInnerLeft = qrX + qrPadding;
  const qrInnerTop = qrY + qrOuterSize - qrPadding;

  for (let row = 0; row < qrMatrix.size; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= qrMatrix.size; col += 1) {
      const dark = col < qrMatrix.size && Boolean(qrMatrix.get(row, col));
      if (dark && runStart === -1) {
        runStart = col;
      } else if (!dark && runStart !== -1) {
        const runCols = col - runStart;
        page.drawRectangle({
          x: qrInnerLeft + runStart * cellSize,
          y: qrInnerTop - (row + 1) * cellSize,
          width: runCols * cellSize,
          height: cellSize,
          color: darkText,
        });
        runStart = -1;
      }
    }
  }

  const leftColMaxWidth = qrX - (margin + 20) - 16;

  page.drawText(
    safeTextForFont(
      boldFont,
      pl ? "JEDNORAZOWY KLUCZ ODZYSKANIA DOSTĘPU" : "ONE-TIME EMERGENCY RECOVERY KEY",
      9.5,
    ),
    {
      x: margin + 20,
      y: y - 24,
      size: 9.5,
      font: boldFont,
      color: brandGreen,
    },
  );

  const keyText = safeTextForFont(boldFont, input.recoveryKey, 16.5);
  const keyFontSize =
    boldFont.widthOfTextAtSize(keyText, 16.5) <= leftColMaxWidth ? 16.5 : 14.5;

  page.drawText(keyText, {
    x: margin + 20,
    y: y - 54,
    size: keyFontSize,
    font: boldFont,
    color: darkText,
  });

  page.drawText(
    safeTextForFont(
      regularFont,
      pl
        ? `Identyfikator końcowy: ${input.keyHint}   •   Klucz działa tylko jeden raz`
        : `Hint: ${input.keyHint}   •   Single-use key`,
      9.5,
    ),
    {
      x: margin + 20,
      y: y - 80,
      size: 9.5,
      font: regularFont,
      color: mutedText,
    },
  );

  page.drawText(
    safeTextForFont(
      regularFont,
      pl
        ? "Zeskanuj kod QR telefonem — automatycznie wypełni e-mail i klucz."
        : "Scan the QR code with your phone to prefill the owner email and key.",
      8.5,
    ),
    {
      x: margin + 20,
      y: y - 99,
      size: 8.5,
      font: regularFont,
      color: brandGreen,
    },
  );

  y -= keyBoxHeight + 18;

  // Metadata panel
  const createdFormatted = new Intl.DateTimeFormat(pl ? "pl-PL" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(input.createdAtIso));

  const ownerDisplay = input.ownerEmail.trim() || "—";

  const metaRows: Array<[string, string]> = [
    [pl ? "Domostwo" : "Household", input.householdName],
    [pl ? "Aktualny właściciel (e-mail)" : "Current owner (email)", ownerDisplay],
    [
      pl ? "E-mail pomocniczy" : "Backup recovery email",
      input.recoveryEmail || (pl ? "Nie ustawiono" : "Not configured"),
    ],
    [pl ? "Wygenerowano" : "Generated at", createdFormatted],
    [pl ? "Adres formularza odzyskania" : "Recovery portal URL", input.recoveryUrl],
  ];

  const metaBoxHeight = metaRows.length * 32 + 20;
  page.drawRectangle({
    x: margin,
    y: y - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    color: creamBg,
    borderColor,
    borderWidth: 1,
  });

  let rowY = y - 22;
  for (const [label, value] of metaRows) {
    page.drawText(safeTextForFont(boldFont, label, 9), {
      x: margin + 18,
      y: rowY,
      size: 9,
      font: boldFont,
      color: mutedText,
    });
    page.drawText(safeTextForFont(regularFont, value, 10), {
      x: margin + 18,
      y: rowY - 13,
      size: 10,
      font: regularFont,
      color: darkText,
    });
    rowY -= 32;
  }

  y -= metaBoxHeight + 24;

  // Instructions
  page.drawText(
    safeTextForFont(
      boldFont,
      pl ? "Jak użyć tej karty w razie utraty dostępu:" : "How to use this card in case of lockout:",
      11.5,
    ),
    {
      x: margin,
      y,
      size: 11.5,
      font: boldFont,
      color: darkText,
    },
  );
  y -= 18;

  const ownerHintPart = input.ownerEmail.trim()
    ? ` (${input.ownerEmail.trim()})`
    : "";

  const steps = pl
    ? [
        `1. Otwórz stronę odzyskania dostępu: ${input.recoveryUrl}`,
        `2. Podaj adres e-mail obecnego właściciela${ownerHintPart}, pełny klucz z tej karty oraz adres e-mail osoby przejmującej lub nowego konta.`,
        `3. Kliknij link potwierdzający wysłany na wskazany nowy adres e-mail (ważny 24 godziny).`,
        `4. Po zatwierdzeniu klucz zostaje trwale zużyty, poprzedni właściciel traci dostęp, a nowy właściciel musi wygenerować nowy klucz odzyskania aby odblokować edycję kartotek.`,
      ]
    : [
        `1. Open the access recovery portal: ${input.recoveryUrl}`,
        `2. Enter the current owner's email${ownerHintPart}, the full recovery key printed above, and the target email address.`,
        `3. Open the 24-hour confirmation link sent to the target email address and sign in or create an account.`,
        `4. Once confirmed, this key is permanently consumed, the previous owner is detached, and you will be asked to generate a new key.`,
      ];

  for (const step of steps) {
    const lines = wrapText(regularFont, step, 10, contentWidth);
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font: regularFont,
        color: darkText,
      });
      y -= 15;
    }
    y -= 6;
  }

  y -= 10;

  // Warning box
  const warningText = pl
    ? "UWAGA BEZPIECZEŃSTWA: Serwis Care My Pet nie przechowuje tego klucza w postaci jawnej i nie jest w stanie go odzyskać. Osoba posiadająca klucz oraz znajomość adresu e-mail właściciela może przejąć własność domostwa. Przechowuj wydruk w bezpiecznym miejscu."
    : "SECURITY NOTICE: Care My Pet stores only a one-way cryptographic hash and cannot recover a lost key. Anyone with this key and the owner's email can initiate ownership recovery. Keep this card stored securely.";
  const warnLines = wrapText(regularFont, warningText, 9.5, contentWidth - 28);
  const warnHeight = warnLines.length * 14 + 26;

  page.drawRectangle({
    x: margin,
    y: y - warnHeight,
    width: contentWidth,
    height: warnHeight,
    color: warnBg,
    borderColor: warnBorder,
    borderWidth: 1,
  });

  let wy = y - 18;
  for (const line of warnLines) {
    page.drawText(line, {
      x: margin + 14,
      y: wy,
      size: 9.5,
      font: regularFont,
      color: darkText,
    });
    wy -= 14;
  }

  return await pdfDoc.save();
}

export async function buildRecoveryKeyPdf(
  input: RecoveryKeyPdfInput,
): Promise<Uint8Array> {
  const assets = await loadBrowserPdfAssets();
  return buildRecoveryKeyPdfWithAssets(input, assets);
}
