import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  buildAssistantSummaryPdf,
  buildSummaryPdfFileName,
} from "../src/features/assistant/assistant-pdf.ts";

const regularFontBytes = new Uint8Array(
  readFileSync("node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
);
const boldFontBytes = new Uint8Array(
  readFileSync("node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
);
const logoPngBytes = new Uint8Array(readFileSync("public/brand/icon-192.png"));

test("buildSummaryPdfFileName normalizes Polish characters into clean slug", () => {
  assert.equal(
    buildSummaryPdfFileName("Maniuś Żółty", "2026-11-12"),
    "manius-zolty-wnioski-asystenta-2026-11-12.pdf",
  );
});

test("buildAssistantSummaryPdf renders Polish diacritics, handles unsupported glyphs, and paginates", async () => {
  const summary = {
    document_title: "Wnioski z badań USG i krwi — Maniuś 🐾",
    executive_summary:
      "Podsumowanie obejmuje trzy badania USG jamy brzusznej oraz morfologię i biochemię z listopada 2026. Zażółcenie i podwyższona kreatynina wymagają kontroli.",
    key_findings: Array.from({ length: 24 }, (_, i) =>
      `Punkt ${i + 1}: Źródło nr ${i + 1} — badanie wykonano w klinice WETERYNARYJNEJ (ząb, łąka, ćma, ń, ó, ś, ź, ż) ze szczegółowym opisem narządów jamy brzusznej i pęcherza moczowego.`,
    ),
    observations_for_owner: [
      "Kontrola nawodnienia i apetytu przed wizytą 13.11.2026.",
      "Zabrać poprzednie opisy USG z września i października.",
    ],
    questions_for_vet: [
      "Czy potrzebne jest kontrolne USG za 4 tygodnie?",
      "Czy obecny poziom kreatyniny wymaga modyfikacji diety nerkowej?",
    ],
    pet_name: "Maniuś",
    species: "cat",
    breed: "Europejski krótkowłosy",
    birth_date: "2015-05-01",
    latest_weight: "4.65 kg (2026-11-09)",
    generated_at: "2026-11-12",
    thread_title: "Co wynika z badań usg?",
    sources: [
      {
        source_type: "medical_report",
        source_id: "00000000-0000-4000-8000-000000000001",
        event_date: "2026-10-22",
        title: "USG jamy brzusznej",
      },
    ],
  };

  const pdfBytes = await buildAssistantSummaryPdf(summary, {
    locale: "pl",
    regularFontBytes,
    boldFontBytes,
    logoPngBytes,
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 2000);

  const parsed = await PDFDocument.load(pdfBytes);
  assert.ok(parsed.getPageCount() >= 2);
});
