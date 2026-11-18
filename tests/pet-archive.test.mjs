import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  ARCHIVE_CODE_LENGTH,
  formatAccessCode,
  generateAccessCode,
  generateSaltHex,
  hashAccessCode,
  isValidArchiveEmail,
  maskEmail,
  normalizeAccessCode,
  signArchiveSession,
  verifyAccessCode,
  verifyArchiveSession,
} from "../supabase/functions/pet-archive/helpers.mjs";
import {
  buildArchivePdfFileName,
  buildPetArchivePdf,
} from "../src/features/archive/archive-pdf.ts";

const regularFontBytes = new Uint8Array(
  readFileSync("node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
);
const boldFontBytes = new Uint8Array(
  readFileSync("node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
);
const logoPngBytes = new Uint8Array(readFileSync("public/brand/icon-192.png"));

test("archive email validation and masking normalize addresses safely", () => {
  assert.equal(isValidArchiveEmail("  Opiekun@Example.PL "), true);
  assert.equal(isValidArchiveEmail("bad-email"), false);
  assert.equal(isValidArchiveEmail(""), false);
  assert.equal(maskEmail("wojciech@example.com"), "wo***@example.com");
  assert.equal(maskEmail("a@example.com"), "a***@example.com");
});

test("access code generation, PBKDF2 hashing and verification work case-insensitively with hyphens", async () => {
  const code = generateAccessCode();
  assert.equal(code.length, ARCHIVE_CODE_LENGTH);
  const formatted = formatAccessCode(code);
  assert.match(formatted, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const salt = generateSaltHex();
  const hash = await hashAccessCode(code, salt);
  assert.equal(hash.length, 64);

  assert.equal(await verifyAccessCode(formatted.toLowerCase(), salt, hash), true);
  assert.equal(await verifyAccessCode(` ${code.slice(0, 4)} ${code.slice(4)} `, salt, hash), true);
  assert.equal(await verifyAccessCode("WRONG123", salt, hash), false);
  assert.equal(normalizeAccessCode(" ab-12 cd "), "AB12CD");
});

test("HMAC archive session tokens validate expiry and tamper resistance", async () => {
  const secret = "test-secret-material-123456";
  const now = 1_760_000_000_000;
  const token = await signArchiveSession(
    secret,
    { link_id: "link-1", pet_id: "pet-1" },
    now,
  );

  const verified = await verifyArchiveSession(secret, token, now + 60_000);
  assert.equal(verified?.link_id, "link-1");
  assert.equal(verified?.pet_id, "pet-1");

  // Expired after 30 minutes
  assert.equal(
    await verifyArchiveSession(secret, token, now + 31 * 60 * 1000),
    null,
  );
  // Tampered token fails
  assert.equal(await verifyArchiveSession(secret, `${token}x`, now + 1000), null);
});

test("buildArchivePdfFileName and buildPetArchivePdf produce valid multi-page A4 PDF with Polish text", async () => {
  assert.equal(
    buildArchivePdfFileName("Łatka Żółta", "2026-11-18T11:50:00Z"),
    "latka-zolta-archiwum-kartoteki-2026-11-18.pdf",
  );

  const payload = {
    session_token: "session-token",
    archive: {
      id: "00000000-0000-4000-8000-000000000010",
      label: "Pełna dokumentacja",
      recipient_hint: "op***@example.com",
      created_at: "2026-11-18T10:00:00Z",
      expires_at: "2026-11-25T10:00:00Z",
      unlocked_count: 1,
    },
    pet: {
      id: "00000000-0000-4000-8000-000000000001",
      imie: "Maja 🐾",
      gatunek: "cat",
      rasa: "Trikolorka europejska",
      data_urodzenia: "2014-05-10",
      plec: "female",
      kastracja: true,
      identyfikacja: "none",
      numer_id: null,
      notatki: "Bardzo spokojna kotka, wrażliwa na stres podczas podróży.",
      tagi: ["nerkowa", "niewychodząca"],
      updated_at: "2026-11-18T09:00:00Z",
      data_urodzenia_przyblizona: true,
      avatar_path: null,
      archived_at: "2026-11-17T20:00:00Z",
      archive_reason: "deceased",
      closed_on: "2026-11-15",
    },
    weights: [
      { id: "w1", kg: 4.1, measured_on: "2026-11-10", note: "Po nawodnieniu" },
    ],
    vital_measurements: [
      {
        id: "v1",
        metric_type: "blood_pressure",
        value_primary: 145,
        value_secondary: 88,
        value_tertiary: 168,
        unit: "mmHg",
        measured_on: "2026-11-08",
        measured_at: "2026-11-08T14:30:00Z",
        context: "vet_calm",
        note: "Spokojny pomiar",
      },
    ],
    fluid_therapies: [
      {
        id: "f1",
        fluid_name: "NaCl 0.9%",
        volume_ml: 120,
        route: "sc",
        medications_added: "B12",
        location: "home",
        administered_at: "2026-11-09T18:00:00Z",
        administered_on: "2026-11-09",
        notes: "Bez problemu",
      },
    ],
    health_events: Array.from({ length: 12 }, (_, idx) => ({
      id: `ev-${idx}`,
      category: "visit",
      title: `Wizyta kontrolna nr ${idx + 1}`,
      event_date: "2026-10-15",
      next_due_date: null,
      clinic: "Przychodnia Świętojańska",
      doctor: "lek. wet. Anna Nowak",
      batch_or_product: "",
      description:
        "Zbadano parametry nerkowe, nawodnienie prawidłowe, zalecono kontynuację diety nerkowej oraz suplementacji.",
      source_path: null,
      source_name: null,
      source_mime: null,
    })),
    reports: [
      {
        id: "rep-1",
        title: "Profil nerkowy i morfologia krwi",
        test_date: "2026-11-02",
        laboratory: "VetLab",
        doctor: "dr Jan Kowalski",
        notes: "Wskazana dalsza kontrola nawodnienia.",
        ai_interpretation: "Kreatynina i mocznik lekko powyżej normy referencyjnej.",
        source_path: "hh/usr/report.pdf",
        source_name: "maja_profil_nerkowy.pdf",
        source_mime: "application/pdf",
        rows: Array.from({ length: 18 }, (_, i) => ({
          id: `row-${i}`,
          name: i === 0 ? "Kreatynina" : `Parametr ${i + 1}`,
          value: i === 0 ? "2.8" : "5.0",
          unit: "mg/dL",
          reference: "0.8 - 1.8",
          category: "renal",
          note: "",
        })),
      },
    ],
    medication_schedules: [
      {
        id: "med-1",
        name: "Gabapentyna",
        dosage: "50 mg",
        schedule_type: "daily",
        interval_value: 1,
        interval_unit: "days",
        start_date: "2026-09-01",
        end_date: null,
        scheduled_time: "08:00",
        scheduled_times: ["08:00", "20:00"],
        instructions: "Podawać w kapsułce",
        is_active: false,
        schedule_category: "medication",
        fluid_name: "",
        fluid_volume_ml: null,
        fluid_route: "sc",
        fluid_location: "home",
      },
    ],
    attachments: [
      {
        id: "rep-1",
        source_type: "report",
        source_path: "hh/usr/report.pdf",
        source_name: "maja_profil_nerkowy.pdf",
        source_mime: "application/pdf",
        title: "Profil nerkowy i morfologia krwi",
        date: "2026-11-02",
      },
    ],
  };

  const pdfBytes = await buildPetArchivePdf(payload, {
    locale: "pl",
    generatedAt: "2026-11-18",
    regularFontBytes,
    boldFontBytes,
    logoPngBytes,
  });

  const parsed = await PDFDocument.load(pdfBytes);
  assert.ok(parsed.getPageCount() >= 2, "Expected multi-page archive PDF");
});
