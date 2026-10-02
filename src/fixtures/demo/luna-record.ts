import type { Translator } from "@/i18n/types";
import type { LabReport } from "@/features/lab-results/types";
import type { RecordEvent } from "@/features/records/types";
import type { PetDocument } from "@/features/documents/types";

// A single fictional source shared by the landing preview and the full demo.
export function getLunaReport(t: Translator) {
  return {
    title: t("kidneyProfileAndBloodCount"),
    date: "2026-09-15",
    source: t("sampleLaboratoryFictionalData"),
    results: [
      {
        id: "crea",
        name: t("creatinineCrea"),
        value: 1.7,
        previous: 1.4,
        unit: "mg/dl",
        reference: { min: 0.8, max: 1.6 },
        status: "above",
        category: "renal",
      },
      {
        id: "urea",
        name: t("ureaBun"),
        value: 38,
        previous: 36,
        unit: "mg/dl",
        reference: { min: 25, max: 50 },
        status: "within",
        category: "renal",
      },
      {
        id: "hgb",
        name: t("haemoglobinHgb"),
        value: 12.4,
        previous: 12.1,
        unit: "g/dl",
        reference: { min: 8, max: 15 },
        status: "within",
        category: "blood",
      },
      {
        id: "rbc",
        name: t("redBloodCellsRbc"),
        value: 7.8,
        previous: 7.6,
        unit: "M/µl",
        reference: { min: 6.5, max: 10 },
        status: "within",
        category: "blood",
      },
      {
        id: "wbc",
        name: t("whiteBloodCellsWbc"),
        value: 8.2,
        previous: 8.9,
        unit: "tys./µl",
        reference: { min: 5.5, max: 19 },
        status: "within",
        category: "blood",
      },
      {
        id: "alt",
        name: "ALT (GPT)",
        value: 42,
        previous: 40,
        unit: "U/l",
        reference: { min: 20, max: 107 },
        status: "within",
        category: "liver",
      },
    ],
  } satisfies LabReport;
}

export function getLunaEvents(t: Translator): readonly RecordEvent[] {
  return [
    {
      id: "kontrola",
      date: "2026-09-28",
      category: "visit",
      title: t("checkUpAndOralExamination"),
      provider: t("sampleVeterinaryPractice"),
      description: t("bloodTestResultsWereDiscussedAndLunas"),
      detail: t("ownersNoteLunaHandledTheVisitCalmly"),
      documentId: "wizyta",
    },
    {
      id: "badania",
      date: "2026-09-15",
      category: "lab",
      title: t("bloodTestKidneyProfileAndBloodCount"),
      provider: t("sampleVeterinaryLaboratory"),
      description: t("sixParametersFromTheDocumentCreatinineAt"),
      detail: t("theResultsWereDiscussedAtTheVisit"),
      documentId: "badania",
    },
    {
      id: "szczepienie",
      date: "2026-04-12",
      category: "vaccination",
      title: t("coreVaccinationRcp"),
      provider: t("sampleVeterinaryPractice"),
      description: t("aRecordOfVaccinationAgainstFelineInfectious"),
      detail: t("nextDateRecordedInTheSampleDocument"),
      documentId: "szczepienie",
    },
    {
      id: "profilaktyka",
      date: "2026-04-05",
      category: "prevention",
      title: t("parasitePrevention"),
      provider: t("ownersNote"),
      description: t("preventiveCareWasRecordedAsCarriedOut"),
      detail: t("thisSampleEntryShowsThatTheHistory"),
    },
  ];
}

export function getLunaDocuments(t: Translator): readonly PetDocument[] {
  return [
    {
      id: "badania",
      title: t("laboratoryTestResultsKidneyProfileAndBlood"),
      date: "2026-09-15",
      category: "lab",
      label: t("testResults"),
      source: t("sampleLaboratory"),
      paragraphs: [
        t("lunasSampleLaboratoryReportAllDataRanges"),
        t("valuesFromThisDocumentAlsoAppearIn"),
      ],
      relatedEventId: "badania",
    },
    {
      id: "wizyta",
      title: t("checkUpAndOralExaminationNotes"),
      date: "2026-09-28",
      category: "visit",
      label: t("checkUp"),
      source: t("samplePractice"),
      paragraphs: [
        t("patientLunaEuropeanShorthairCat4Years"),
        t("resultsFrom15SeptemberWereDiscussedDuring"),
        t("nextCheckUp12October2026This"),
      ],
      relatedEventId: "kontrola",
    },
    {
      id: "szczepienie",
      title: t("coreVaccinationConfirmationRcp"),
      date: "2026-04-12",
      category: "vaccination",
      label: t("vaccination"),
      source: t("samplePractice"),
      paragraphs: [
        t("patientLunaSampleConfirmationOfAnRcp"),
        t("nextDoseDateRecordedInTheDocument"),
        t("thisPreviewIsNotARealCertificate"),
      ],
      relatedEventId: "szczepienie",
    },
    {
      id: "sterylizacja",
      title: t("spayProcedureNotes"),
      date: "2023-05-14",
      category: "visit",
      label: t("surgicalProcedure"),
      source: t("sampleClinic"),
      paragraphs: [
        t("lunasSampleProcedureNotesFrom14May"),
        t("theSpayProcedureWasRecordedThisDocument"),
        t("fictionalDataThisPreviewContainsNoPostoperative"),
      ],
    },
    {
      id: "rachunek",
      title: t("receiptBloodTestsAndCheckUp"),
      date: "2026-09-28",
      category: "invoice",
      label: t("receipt"),
      source: t("samplePractice"),
      paragraphs: [
        t("aSampleBreakdownOfLunasCareCosts"),
        t("laboratoryTestsPln16000CheckUp"),
        t("demoDocumentNotAnInvoiceOrProof"),
      ],
      relatedEventId: "kontrola",
    },
  ];
}

export const creatinineTrend = [
  { date: "2025-10-15", value: 1.2 },
  { date: "2026-04-12", value: 1.4 },
  { date: "2026-09-15", value: 1.7 },
] as const;
