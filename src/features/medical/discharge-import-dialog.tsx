"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconFlask,
  IconHistory,
  IconInfoCircle,
  IconPill,
  IconScale,
  IconSparkles,
  IconStethoscope,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { Pet } from "@/features/pets/types";
import {
  commitDischargeBatchImport,
  computeFileSha256,
  extractClinicalDischarge,
} from "./discharge-import-service";
import type { DischargeParsedState } from "./discharge-types";
import { FormattedMedicalText } from "./formatted-text";
import {
  getPdfImportHistory,
  getSuggestedNextPages,
  recordPdfImportPages,
  type ImportedPdfHistory,
} from "./pdf-history";
import type { PdfInfo } from "./pdf-page-utils";
import { DischargePdfPageViewer } from "./discharge-pdf-page-viewer";
import "@/styles/discharge-import.css";

const MAX_DISCHARGE_PAGES = 10;

interface DischargeImportDialogProps {
  pet: Pick<Pet, "id" | "imie"> & { gospodarstwo_id?: string };
  householdId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabKey = "labs" | "events" | "weights" | "meds";
type ImportStep = "upload" | "configure" | "analyzing" | "review" | "success";

function formatPagesSummary(pages: number[], pl: boolean): string {
  if (!pages || pages.length === 0) return pl ? "brak" : "none";
  if (pages.length === 1) return pl ? `strona ${pages[0]}` : `page ${pages[0]}`;
  const isContinuous = pages.every((p, idx) => idx === 0 || p === pages[idx - 1] + 1);
  if (isContinuous) {
    return pl
      ? `strony ${pages[0]}–${pages[pages.length - 1]}`
      : `pages ${pages[0]}–${pages[pages.length - 1]}`;
  }
  return pl ? `strony ${pages.join(", ")}` : `pages ${pages.join(", ")}`;
}

function formatPagesCount(count: number, pl: boolean, accusative = false): string {
  if (!pl) return count === 1 ? "page" : "pages";
  if (count === 1) return accusative ? "stronę" : "strona";
  if (count < 5) return "strony";
  return "stron";
}

export function DischargeImportDialog({
  pet,
  householdId,
  open,
  onClose,
  onSuccess,
}: DischargeImportDialogProps) {
  const locale: "pl" | "en" = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [step, setStep] = useState<ImportStep>("upload");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [rawSha256, setRawSha256] = useState<string>("");
  const [pdfHistory, setPdfHistory] = useState<ImportedPdfHistory | null>(null);

  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [scrollToPageTarget, setScrollToPageTarget] = useState<number | null>(null);
  const [activePagesInfo, setActivePagesInfo] = useState<{
    pages: number[];
    total: number;
  } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState<string>("");
  const [discharge, setDischarge] = useState<DischargeParsedState | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("labs");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    reports_count: number;
    events_count: number;
    weights_count: number;
    vitals_count?: number;
  } | null>(null);

  const [petDetails, setPetDetails] = useState<{ imie: string; gospodarstwo_id?: string }>({
    imie: pet.imie || "",
    gospodarstwo_id: householdId || pet.gospodarstwo_id,
  });

  useEffect(() => {
    if (!petDetails.imie || !petDetails.gospodarstwo_id) {
      let cancelled = false;
      const client = createClient();
      void client
        .from("zwierze")
        .select("imie, gospodarstwo_id")
        .eq("id", pet.id)
        .maybeSingle()
        .then(
          ({ data, error: petErr }) => {
            if (cancelled) return;
            if (!petErr && data) {
              setPetDetails((prev) => ({
                imie: prev.imie || data.imie || "",
                gospodarstwo_id: prev.gospodarstwo_id || data.gospodarstwo_id || undefined,
              }));
            }
          },
          (err: unknown) => {
            if (!cancelled) {
              console.error("Failed to load pet details for discharge import:", err);
            }
          },
        );
      return () => {
        cancelled = true;
      };
    }
  }, [pet.id, petDetails.imie, petDetails.gospodarstwo_id]);

  // Sync open state with HTML dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  function handleReset() {
    setStep("upload");
    setRawFile(null);
    setPdfInfo(null);
    setRawSha256("");
    setPdfHistory(null);
    setSelectedPages([]);
    setScrollToPageTarget(null);
    setFile(null);
    setSha256("");
    setDischarge(null);
    setActivePagesInfo(null);
    setError(null);
    setSaveResult(null);
  }

  function handleCloseDialog() {
    handleReset();
    onClose();
  }

  async function handleFileProcess(selectedFile: File) {
    if (selectedFile.type !== "application/pdf") {
      setError(
        pl
          ? "Dozwolone są wyłącznie pliki PDF (np. wypis z kliniki)."
          : "Only PDF files are allowed (e.g. a clinic discharge summary).",
      );
      return;
    }
    if (selectedFile.size > 12 * 1024 * 1024) {
      setError(
        pl
          ? "Plik jest za duży (maksymalny rozmiar to 12 MB)."
          : "The file is too large (maximum size is 12 MB).",
      );
      return;
    }

    setError(null);
    setIsInspecting(true);

    try {
      const { inspectPdf } = await import("./pdf-page-utils");
      const [info, computedHash] = await Promise.all([
        inspectPdf(selectedFile),
        computeFileSha256(selectedFile),
      ]);

      setRawFile(selectedFile);
      setPdfInfo(info);
      setRawSha256(computedHash);

      const history = getPdfImportHistory(pet.id, computedHash);
      setPdfHistory(history);

      const suggested = getSuggestedNextPages(info.pageCount, history, MAX_DISCHARGE_PAGES);
      setSelectedPages(suggested.pages);
      if (suggested.pages.length > 0) {
        setScrollToPageTarget(suggested.pages[0]);
      }

      setStep("configure");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg ||
          (pl
            ? "Nie udało się odczytać struktury pliku PDF. Upewnij się, że plik nie jest uszkodzony."
            : "Could not read the PDF file structure. Make sure the file is not corrupted."),
      );
      setStep("upload");
    } finally {
      setIsInspecting(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      void handleFileProcess(droppedFile);
    }
  }

  function handleTogglePage(pageNumber: number) {
    if (!pdfInfo || isAllPagesAlreadyImported) return;
    setError(null);

    setSelectedPages((prev) => {
      if (prev.includes(pageNumber)) {
        return prev.filter((p) => p !== pageNumber);
      }
      if (prev.length >= MAX_DISCHARGE_PAGES) {
        setError(
          pl
            ? `Osiągnięto limit ${MAX_DISCHARGE_PAGES} stron na jedną analizę. Odznacz inną stronę, aby dodać stronę ${pageNumber}.`
            : `Limit of ${MAX_DISCHARGE_PAGES} pages per analysis reached. Unselect another page to add page ${pageNumber}.`,
        );
        return prev;
      }
      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  }

  function handlePillClick(pageNumber: number) {
    handleTogglePage(pageNumber);
    setScrollToPageTarget(pageNumber);
  }

  function handleSelectFirstPages(count = MAX_DISCHARGE_PAGES) {
    if (!pdfInfo) return;
    setError(null);
    const limit = Math.min(count, pdfInfo.pageCount);
    const pages: number[] = [];
    for (let p = 1; p <= limit; p++) pages.push(p);
    setSelectedPages(pages);
    setScrollToPageTarget(1);
  }

  function handleSelectUnimportedPages() {
    if (!pdfInfo) return;
    setError(null);
    const history = getPdfImportHistory(pet.id, rawSha256);
    const suggested = getSuggestedNextPages(pdfInfo.pageCount, history, MAX_DISCHARGE_PAGES);
    setSelectedPages(suggested.pages);
    if (suggested.pages.length > 0) {
      setScrollToPageTarget(suggested.pages[0]);
    }
  }

  function handleClearSelection() {
    setError(null);
    setSelectedPages([]);
  }

  async function handleStartExtraction() {
    if (!rawFile || !pdfInfo) return;

    if (selectedPages.length === 0) {
      setError(
        pl
          ? "Wybierz przynajmniej jedną stronę do analizy."
          : "Select at least one page to analyze.",
      );
      return;
    }
    if (selectedPages.length > MAX_DISCHARGE_PAGES) {
      setError(
        pl
          ? `Wybrano ${selectedPages.length} stron. Maksymalny dopuszczalny limit to ${MAX_DISCHARGE_PAGES} stron w jednej turze.`
          : `Selected ${selectedPages.length} pages. The maximum limit is ${MAX_DISCHARGE_PAGES} pages per batch.`,
      );
      return;
    }

    setError(null);
    setStep("analyzing");

    try {
      const { sliceSelectedPdfPages } = await import("./pdf-page-utils");
      const fileToProcess = await sliceSelectedPdfPages(rawFile, selectedPages);
      setFile(fileToProcess);
      setActivePagesInfo({ pages: selectedPages, total: pdfInfo.pageCount });

      const result = await extractClinicalDischarge(pet.id, fileToProcess, locale);
      setDischarge(result.discharge);
      setSha256(result.sha256);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg ||
          (pl
            ? "Nie udało się przeanalizować wybranego fragmentu. Spróbuj ponownie."
            : "Could not analyze the selected pages. Please try again."),
      );
      setStep("configure");
    }
  }

  function handleNextChunkImport() {
    if (!rawFile || !pdfInfo) return;

    // Odśwież historię z localStorage
    const history = getPdfImportHistory(pet.id, rawSha256);
    setPdfHistory(history);

    const suggested = getSuggestedNextPages(pdfInfo.pageCount, history, MAX_DISCHARGE_PAGES);
    setSelectedPages(suggested.pages);
    if (suggested.pages.length > 0) {
      setScrollToPageTarget(suggested.pages[0]);
    }

    setDischarge(null);
    setSaveResult(null);
    setFile(null);
    setActivePagesInfo(null);
    setStep("configure");
  }

  function toggleReport(id: string) {
    if (!discharge) return;
    setDischarge({
      ...discharge,
      lab_reports: discharge.lab_reports.map((r) =>
        r.id === id ? { ...r, selected: !r.selected } : r,
      ),
    });
  }

  function toggleEvent(id: string) {
    if (!discharge) return;
    setDischarge({
      ...discharge,
      clinical_events: discharge.clinical_events.map((e) =>
        e.id === id ? { ...e, selected: !e.selected } : e,
      ),
    });
  }

  function toggleMeasurement(id: string) {
    if (!discharge) return;
    setDischarge({
      ...discharge,
      measurements: discharge.measurements.map((m) =>
        m.id === id ? { ...m, selected: !m.selected } : m,
      ),
    });
  }

  function toggleAllInTab(tab: TabKey, selected: boolean) {
    if (!discharge) return;
    if (tab === "labs") {
      setDischarge({
        ...discharge,
        lab_reports: discharge.lab_reports.map((r) => ({ ...r, selected })),
      });
    } else if (tab === "events") {
      setDischarge({
        ...discharge,
        clinical_events: discharge.clinical_events.map((e) => ({ ...e, selected })),
      });
    } else if (tab === "weights") {
      setDischarge({
        ...discharge,
        measurements: discharge.measurements.map((m) => ({ ...m, selected })),
      });
    }
  }

  async function handleConfirmImport() {
    if (!discharge || !file || !sha256 || saving) return;
    setSaving(true);
    setError(null);

    try {
      let effectiveHouseholdId = householdId || pet.gospodarstwo_id || petDetails.gospodarstwo_id;
      if (!effectiveHouseholdId) {
        const client = createClient();
        const { data: petRow, error: petErr } = await client
          .from("zwierze")
          .select("gospodarstwo_id, imie")
          .eq("id", pet.id)
          .maybeSingle();
        if (petErr) throw petErr;
        effectiveHouseholdId = petRow?.gospodarstwo_id;
        if (petRow?.imie && !petDetails.imie) {
          setPetDetails((prev) => ({ ...prev, imie: petRow.imie }));
        }
      }

      if (!effectiveHouseholdId) {
        throw new Error(
          pl ? "Brak identyfikatora gospodarstwa domowego." : "Missing household ID.",
        );
      }

      const res = await commitDischargeBatchImport({
        petId: pet.id,
        householdId: effectiveHouseholdId,
        file,
        sha256,
        state: discharge,
        locale,
      });

      // Zapisz zaimportowane strony w historii przeglądarki
      if (activePagesInfo && rawSha256) {
        const updatedHistory = recordPdfImportPages(
          pet.id,
          rawSha256,
          rawFile?.name || file.name,
          activePagesInfo.pages,
        );
        if (updatedHistory) setPdfHistory(updatedHistory);
      }

      setSaveResult(res);
      setStep("success");
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg ||
          (pl
            ? "Wystąpił błąd podczas zapisywania danych do kartoteki."
            : "An error occurred while saving records to the pet profile."),
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedLabsCount = discharge?.lab_reports.filter((r) => r.selected).length ?? 0;
  const totalLabsCount = discharge?.lab_reports.length ?? 0;

  const selectedEventsCount = discharge?.clinical_events.filter((e) => e.selected).length ?? 0;
  const totalEventsCount = discharge?.clinical_events.length ?? 0;

  const selectedWeightsCount =
    discharge?.measurements.filter((m) => m.selected).length ?? 0;
  const totalWeightsCount =
    discharge?.measurements.length ?? 0;

  const totalSelected = selectedLabsCount + selectedEventsCount + selectedWeightsCount;

  const effectivePetName = petDetails.imie || pet.imie;

  const isNameMismatch = Boolean(
    discharge?.patient_name &&
      effectivePetName &&
      !discharge.patient_name.toLowerCase().includes(effectivePetName.toLowerCase()) &&
      !effectivePetName.toLowerCase().includes(discharge.patient_name.toLowerCase()),
  );

  const importedSet = new Set(pdfHistory?.allImportedPages || []);
  const selectedSet = new Set(selectedPages);
  const totalPagesCount = pdfInfo?.pageCount || 0;
  const remainingPagesCount = Math.max(0, totalPagesCount - importedSet.size);
  const hasRemainingUnimportedPages = totalPagesCount > 0 && remainingPagesCount > 0;
  const isAllPagesAlreadyImported =
    totalPagesCount > 0 &&
    Boolean(pdfHistory && pdfHistory.allImportedPages.length > 0) &&
    !hasRemainingUnimportedPages;

  return (
    <dialog
      ref={dialogRef}
      className="discharge-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (saving || step === "analyzing") {
          e.preventDefault();
        } else {
          handleCloseDialog();
        }
      }}
    >
      <div className="discharge-dialog-container">
        {/* Header */}
        <header className="discharge-dialog-header">
          <div className="discharge-header-content">
            <span className="discharge-badge-ai">
              <IconSparkles size={14} aria-hidden="true" />
              <span>Gemini 3.5 Flash</span>
            </span>
            <h2 id={titleId} className="discharge-dialog-title">
              {pl
                ? "Inteligentny Importer Wypisów z Lecznicy"
                : "Smart Clinic Discharge Importer"}
            </h2>
            <p className="discharge-dialog-subtitle">
              {pl
                ? "Rozpoznaj i podziel wielostronicowy wyciąg leczenia na badania, wizyty i wagę pupila."
                : "Recognize and split a multi-page medical discharge into lab tests, visits, and pet weight."}
            </p>
          </div>
          <button
            type="button"
            className="discharge-close-btn"
            onClick={handleCloseDialog}
            disabled={saving || step === "analyzing"}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Error notification */}
        {error && (
          <div className="discharge-error-banner" role="alert">
            <IconAlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Krok 1: Wgrywanie pliku */}
        {step === "upload" && (
          <div className="discharge-upload-step">
            <div
              className={`discharge-dropzone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileProcess(f);
                }}
              />
              <div className="discharge-dropzone-icon">
                {isInspecting ? (
                  <IconSparkles size={36} className="discharge-spinner-pulse" aria-hidden="true" />
                ) : (
                  <IconUpload size={36} aria-hidden="true" />
                )}
              </div>
              <h3>
                {isInspecting
                  ? pl
                    ? "Sprawdzanie pliku PDF…"
                    : "Inspecting PDF file…"
                  : pl
                    ? "Przeciągnij lub kliknij, aby wgrać wypis"
                    : "Drag & drop or click to upload a discharge PDF"}
              </h3>
              <p>
                {pl
                  ? `Obsługujemy wielostronicowe pliki PDF (np. z Klinika XP, Provet, Vet-Gabinet) do 12 MB. Jednorazowy limit analizy to ${MAX_DISCHARGE_PAGES} stron.`
                  : `Supports multi-page PDF files (e.g. from clinic software) up to 12 MB. Single-batch analysis limit is ${MAX_DISCHARGE_PAGES} pages.`}
              </p>
              <div className="discharge-dropzone-features">
                <span>
                  {pl ? "🩺 Badania krwi, moczu i USG" : "🩺 Blood, urine & ultrasound reports"}
                </span>
                <span>
                  {pl ? "📋 Wizyty i zalecenia lekarza" : "📋 Clinic visits & vet recommendations"}
                </span>
                <span>
                  {pl ? "⚖️ Chronologiczne pomiary wagi" : "⚖️ Chronological weight logs"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Krok 1.5: Konfiguracja i wybór stron (Configure Step) */}
        {step === "configure" && pdfInfo && rawFile && (
          <div className="discharge-configure-step">
            <div className="discharge-configure-grid">
              {/* Kolumna 1: Interaktywny podgląd stron PDF */}
              <div className="discharge-preview-col">
                <DischargePdfPageViewer
                  file={rawFile}
                  totalPages={pdfInfo.pageCount}
                  selectedPages={selectedPages}
                  importedPages={pdfHistory?.allImportedPages || []}
                  onTogglePage={isAllPagesAlreadyImported ? () => {} : handleTogglePage}
                  activeScrollToPage={scrollToPageTarget}
                  readOnly={isAllPagesAlreadyImported}
                />
              </div>

              {/* Kolumna 2: Sterowanie, historia i wybór stron */}
              <div className="discharge-controls-col">
                {/* Karta pliku */}
                <div className="discharge-file-card">
                  <div className="discharge-file-icon">
                    <IconFileText size={24} aria-hidden="true" />
                  </div>
                  <div className="discharge-file-details">
                    <span className="discharge-file-name" title={pdfInfo.name}>
                      {pdfInfo.name}
                    </span>
                    <div className="discharge-file-meta">
                      <span>{(pdfInfo.byteSize / (1024 * 1024)).toFixed(1)} MB</span>
                      <span>•</span>
                      <span
                        className={`discharge-pages-badge${
                          pdfInfo.pageCount > MAX_DISCHARGE_PAGES ? " is-warning" : ""
                        }`}
                      >
                        📄 {pdfInfo.pageCount} {formatPagesCount(pdfInfo.pageCount, pl)}
                      </span>
                    </div>
                  </div>
                </div>

                {isAllPagesAlreadyImported ? (
                  <div className="discharge-duplicate-card" role="alert">
                    <div className="discharge-duplicate-header">
                      <div className="discharge-duplicate-icon">
                        <IconCheck size={28} aria-hidden="true" />
                      </div>
                      <div>
                        <h3>
                          {pl
                            ? "Ten dokument jest już w kartotece"
                            : "This document is already in the profile"}
                        </h3>
                        <p className="discharge-duplicate-file">
                          {pl ? (
                            <>
                              Wszystkie <strong>{pdfInfo.pageCount} stron</strong> tego pliku zostały już pomyślnie zaimportowane.
                            </>
                          ) : (
                            <>
                              All <strong>{pdfInfo.pageCount} pages</strong> of this file have already been imported.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="discharge-duplicate-body">
                      <p>
                        {pl
                          ? "Wszystkie badania laboratoryjne, wizyty lekarskie i pomiary wagi z tego wypisu znajdują się w kartotece pupila."
                          : "All lab tests, clinic visits, and weight logs from this discharge are already saved in the pet's record."}
                      </p>
                      <p className="discharge-duplicate-hint">
                        {pl
                          ? "Nie ma potrzeby ponownego odczytu ani dodawania tego samego dokumentu."
                          : "There is no need to scan or upload the same document again."}
                      </p>
                    </div>
                    <div className="discharge-duplicate-actions">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleCloseDialog}
                      >
                        {pl ? "Przejdź do kartoteki pupila" : "Go to pet profile"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setStep("upload");
                          setRawFile(null);
                          setPdfInfo(null);
                          setSelectedPages([]);
                        }}
                      >
                        {pl ? "Wybierz inny plik" : "Choose another file"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Ostrzeżenie i szczegółowa instrukcja dla opiekuna gdy > 10 stron */}
                    {pdfInfo.pageCount > MAX_DISCHARGE_PAGES ? (
                      <div className="discharge-oversize-guide">
                        <div className="discharge-guide-header">
                          <IconAlertTriangle
                            size={24}
                            className="text-amber-800 shrink-0"
                            aria-hidden="true"
                          />
                          <div>
                            <h4>
                              {pl
                                ? `Dokument ma ${pdfInfo.pageCount} stron — wybierz pojedyncze strony do analizy`
                                : `Document has ${pdfInfo.pageCount} pages — select pages to analyze`}
                            </h4>
                            <p>
                              {pl ? (
                                <>
                                  Ze względu na limity wielkości odpowiedzi modeli AI oraz ochronę ciągłości badań,
                                  jednorazowo analizujemy maksymalnie{" "}
                                  <strong>{MAX_DISCHARGE_PAGES} stron</strong>. Przewijaj podgląd po lewej i
                                  wybierz strony, które chcesz przetworzyć.
                                </>
                              ) : (
                                <>
                                  To stay within AI response limits and preserve test continuity,
                                  we analyze up to <strong>{MAX_DISCHARGE_PAGES} pages</strong> per batch.
                                  Scroll the preview on the left and select the pages to process.
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="discharge-guide-steps">
                          <div className="discharge-step-item">
                            <span className="discharge-step-number">1</span>
                            <div>
                              <strong>
                                {pl
                                  ? "Przeglądaj treść na scrollowanym podglądzie"
                                  : "Browse pages in the scrollable preview"}
                              </strong>
                              <p>
                                {pl
                                  ? "Kliknij bezpośrednio w kartę strony lub jej pole wyboru po lewej stronie, aby dodać ją do analizy."
                                  : "Click directly on a page card or its checkbox on the left to add it to the analysis."}
                              </p>
                            </div>
                          </div>
                          <div className="discharge-step-item">
                            <span className="discharge-step-number">2</span>
                            <div>
                              <strong>
                                {pl
                                  ? "Zaimportuj pozostałe strony w kolejnej turze"
                                  : "Import remaining pages in the next batch"}
                              </strong>
                              <p>
                                {pl
                                  ? "Po zapisaniu możesz wybrać ten sam plik ponownie – aplikacja pamięta, które strony już dodano do kartoteki."
                                  : "After saving, you can import the remaining pages — the app remembers which pages were already added."}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="discharge-guide-tip">
                          <IconInfoCircle size={16} aria-hidden="true" />
                          <span>
                            {pl ? (
                              <>
                                <strong>Wskazówka:</strong> Sprawdź na podglądzie, gdzie kończą się poszczególne
                                badania. Zaznaczaj pełne wizyty, aby uniknąć ucięcia wyników badań w połowie.
                              </>
                            ) : (
                              <>
                                <strong>Tip:</strong> Check the preview to see where each test ends.
                                Select complete visits to avoid cutting lab results in half.
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="discharge-limit-notice">
                        <IconCheck size={20} className="text-emerald-700 shrink-0" aria-hidden="true" />
                        <div>
                          <strong>
                            {pl ? "Dokument mieści się w limicie" : "Document is within the limit"}
                          </strong>
                          <p>
                            {pl
                              ? `Plik ma ${pdfInfo.pageCount} ${formatPagesCount(pdfInfo.pageCount, true)} (mieści się w limicie ${MAX_DISCHARGE_PAGES} stron). Wszystkie strony zostały domyślnie zaznaczone, ale możesz dostosować wybór.`
                              : `The file has ${pdfInfo.pageCount} ${formatPagesCount(pdfInfo.pageCount, false)} (within the ${MAX_DISCHARGE_PAGES}-page limit). All pages are selected by default, and you can adjust the selection.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sekcja historii wcześniejszych importów tego pliku (gdy plik jest zaimportowany częściowo) */}
                    {pdfHistory && pdfHistory.allImportedPages.length > 0 && (
                      <div className="discharge-history-card">
                        <div className="discharge-history-header">
                          <IconHistory
                            size={18}
                            className="text-emerald-700 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="discharge-history-content">
                            <strong>
                              {pl
                                ? "Wcześniej zaimportowano już strony z tego pliku:"
                                : "Previously imported pages from this file:"}
                            </strong>
                            <div className="discharge-history-ranges">
                              <span className="discharge-history-tag">
                                ✓ {formatPagesSummary(pdfHistory.allImportedPages, pl)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {hasRemainingUnimportedPages && (
                          <button
                            type="button"
                            className="discharge-suggested-btn"
                            onClick={handleSelectUnimportedPages}
                          >
                            <span>
                              {pl
                                ? `Zaznacz kolejne niezaimportowane strony (do ${MAX_DISCHARGE_PAGES} stron)`
                                : `Select next unimported pages (up to ${MAX_DISCHARGE_PAGES} pages)`}
                            </span>
                            <IconArrowRight size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Interaktywny selektor stron */}
                    <div className="discharge-range-selector-box">
                      <div className="discharge-selector-header">
                        <div className="discharge-selector-title-wrap">
                          <h4>{pl ? "Wybierz strony do analizy:" : "Select pages to analyze:"}</h4>
                          <span
                            className={`discharge-counter-chip${
                              selectedPages.length === 0
                                ? " is-empty"
                                : selectedPages.length === MAX_DISCHARGE_PAGES
                                  ? " is-limit"
                                  : " is-active"
                            }`}
                          >
                            {pl
                              ? `${selectedPages.length} z ${MAX_DISCHARGE_PAGES} stron`
                              : `${selectedPages.length} of ${MAX_DISCHARGE_PAGES} pages`}
                          </span>
                        </div>

                        <div className="discharge-quick-presets">
                          {pdfInfo.pageCount <= MAX_DISCHARGE_PAGES ? (
                            <button
                              type="button"
                              className="discharge-preset-pill"
                              onClick={() => handleSelectFirstPages(pdfInfo.pageCount)}
                            >
                              {pl
                                ? `Wszystkie strony (1–${pdfInfo.pageCount})`
                                : `All pages (1–${pdfInfo.pageCount})`}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="discharge-preset-pill"
                                onClick={() => handleSelectFirstPages(MAX_DISCHARGE_PAGES)}
                              >
                                {pl ? "Pierwsze 10 (str. 1–10)" : "First 10 (p. 1–10)"}
                              </button>
                              {hasRemainingUnimportedPages && (
                                <button
                                  type="button"
                                  className="discharge-preset-pill is-suggested"
                                  onClick={handleSelectUnimportedPages}
                                >
                                  {pl
                                    ? `Niezaimportowane (${remainingPagesCount})`
                                    : `Unimported (${remainingPagesCount})`}
                                </button>
                              )}
                            </>
                          )}
                          {selectedPages.length > 0 && (
                            <button
                              type="button"
                              className="discharge-preset-pill"
                              onClick={handleClearSelection}
                            >
                              {pl ? "Wyczyść" : "Clear"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Wizualna siatka guzików stron */}
                      <div
                        className="discharge-page-strip"
                        role="group"
                        aria-label={
                          pl
                            ? "Kafelki wyboru pojedynczych stron"
                            : "Individual page selection buttons"
                        }
                      >
                        {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((pNum) => {
                          const isImported = importedSet.has(pNum);
                          const isSelected = selectedSet.has(pNum);
                          return (
                            <button
                              key={pNum}
                              type="button"
                              className={`discharge-page-pill${isImported ? " is-imported" : ""}${
                                isSelected ? " is-selected" : ""
                              }`}
                              onClick={() => handlePillClick(pNum)}
                              title={
                                pl
                                  ? `Strona ${pNum}${
                                      isSelected ? " (zaznaczona do analizy)" : ""
                                    }${isImported ? " [wcześniej zaimportowana]" : ""}`
                                  : `Page ${pNum}${
                                      isSelected ? " (selected for analysis)" : ""
                                    }${isImported ? " [previously imported]" : ""}`
                              }
                            >
                              <span>{pNum}</span>
                              {isSelected && <IconCheck size={11} aria-hidden="true" />}
                              {!isSelected && isImported && (
                                <IconHistory size={10} aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="discharge-strip-legend">
                        <span>
                          <span className="discharge-legend-dot is-selected" />{" "}
                          {pl
                            ? `Wybrana do analizy (maks. ${MAX_DISCHARGE_PAGES})`
                            : `Selected for analysis (max ${MAX_DISCHARGE_PAGES})`}
                        </span>
                        <span>
                          <span className="discharge-legend-dot is-imported" />{" "}
                          {pl ? "Wcześniej zaimportowana" : "Previously imported"}
                        </span>
                        <span>
                          <span className="discharge-legend-dot" />{" "}
                          {pl ? "Dostępna" : "Available"}
                        </span>
                      </div>

                      {/* Podsumowanie zaznaczonych stron */}
                      <div className="discharge-selection-summary-text">
                        {selectedPages.length > 0 ? (
                          <span>
                            {pl ? (
                              <>
                                ✓ Wybrano do analizy ({selectedPages.length}{" "}
                                {formatPagesCount(selectedPages.length, true, true)}):{" "}
                                <strong>{formatPagesSummary(selectedPages, true)}</strong>. Klikaj strony na podglądzie po lewej lub guziki powyżej, aby zmienić wybór.
                              </>
                            ) : (
                              <>
                                ✓ Selected for analysis ({selectedPages.length}{" "}
                                {formatPagesCount(selectedPages.length, false)}):{" "}
                                <strong>{formatPagesSummary(selectedPages, false)}</strong>. Click pages in the preview on the left or the buttons above to adjust.
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="text-amber-800">
                            {pl
                              ? "Nie wybrano żadnej strony. Kliknij stronę na podglądzie po lewej lub guzik z numerem strony, aby zaznaczyć ją do analizy."
                              : "No pages selected. Click a page in the preview on the left or a page number button to select it."}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stopka konfiguracji (ukryta gdy dokument jest już w całości zaimportowany) */}
            {!isAllPagesAlreadyImported && (
              <div className="discharge-configure-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep("upload");
                    setRawFile(null);
                    setPdfInfo(null);
                  }}
                >
                  {pl ? "Wybierz inny plik" : "Choose another file"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={selectedPages.length === 0 || selectedPages.length > MAX_DISCHARGE_PAGES}
                  onClick={() => void handleStartExtraction()}
                >
                  <IconSparkles size={16} aria-hidden="true" />
                  <span>
                    {pl
                      ? `Rozpocznij analizę (${selectedPages.length} ${formatPagesCount(selectedPages.length, true, true)})`
                      : `Start analysis (${selectedPages.length} ${formatPagesCount(selectedPages.length, false)})`}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Krok 2: Analiza AI */}
        {step === "analyzing" && (
          <div className="discharge-analyzing-step">
            <div className="discharge-spinner-pulse" aria-hidden="true">
              <IconSparkles size={32} />
            </div>
            <h3>
              {pl
                ? "Sztuczna inteligencja analizuje dokument…"
                : "AI is analyzing the document…"}
            </h3>
            <p className="discharge-analyzing-hint">
              {pl
                ? "Wielostronicowe wypisy analizujemy za pomocą multimodalnego modelu Gemini."
                : "Multi-page discharge summaries are analyzed using the multimodal Gemini model."}
            </p>
            <ul className="discharge-analyzing-steps">
              <li className="is-active">
                {pl ? "Wczytywanie stron dokumentu" : "Loading document pages"} ({file?.name}
                {activePagesInfo && (
                  <span>
                    , {formatPagesSummary(activePagesInfo.pages, pl)}{" "}
                    {pl ? "z" : "of"} {activePagesInfo.total}
                  </span>
                )}
                )
              </li>
              <li className="is-active">
                {pl
                  ? "Wyodrębnianie dat, parametrów laboratoryjnych i opisów USG"
                  : "Extracting dates, lab parameters, and ultrasound notes"}
              </li>
              <li className="is-active">
                {pl
                  ? "Weryfikacja ciągłości badań i pomiarów wagi"
                  : "Verifying test continuity and weight measurements"}
              </li>
            </ul>
          </div>
        )}

        {/* Krok 3: Weryfikacja i podgląd (Review Wizard) */}
        {step === "review" && discharge && (
          <div className="discharge-review-step">
            {/* Ostrzeżenie o ucięciu badania na granicy stron (Boundary Alert) */}
            {discharge.boundary_alert?.has_cut_off_at_end && (
              <div className="discharge-boundary-alert-banner" role="alert">
                <IconAlertTriangle size={22} className="text-amber-800 shrink-0" aria-hidden="true" />
                <div>
                  <strong>
                    {pl
                      ? "Uwaga: badanie ucięte na końcu wybranego fragmentu!"
                      : "Warning: a test is cut off at the end of the selected pages!"}
                  </strong>
                  <p>{discharge.boundary_alert.cut_off_description}</p>
                  <p className="discharge-boundary-tip">
                    {pl ? (
                      <>
                        💡 Wskazówka: Przy kolejnej turze importu zalecamy uwzględnić stronę{" "}
                        <strong>
                          {activePagesInfo?.pages[activePagesInfo.pages.length - 1]}
                        </strong>{" "}
                        jako stronę początkową nowej partii, aby model scalił to badanie w całości bez brakujących parametrów.
                      </>
                    ) : (
                      <>
                        💡 Tip: In the next import batch, include page{" "}
                        <strong>
                          {activePagesInfo?.pages[activePagesInfo.pages.length - 1]}
                        </strong>{" "}
                        as the starting page so the model can merge the full test without missing parameters.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Ostrzeżenie o niezgodności imienia pupila */}
            {isNameMismatch && (
              <div className="discharge-warning-banner">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>{pl ? "Uwaga dotycząca pacjenta:" : "Patient mismatch warning:"}</strong>
                  <p>
                    {pl ? (
                      <>
                        Dokument wskazuje pacjenta <strong>&quot;{discharge.patient_name}&quot;</strong>,
                        podczas gdy aktualna kartoteka należy do pupila{" "}
                        <strong>&quot;{effectivePetName || pet.imie || "pupila"}&quot;</strong>.
                        Upewnij się, że wgrywasz właściwy dokument.
                      </>
                    ) : (
                      <>
                        The document names patient <strong>&quot;{discharge.patient_name}&quot;</strong>,
                        while the current profile belongs to{" "}
                        <strong>&quot;{effectivePetName || pet.imie || "this pet"}&quot;</strong>.
                        Make sure you are uploading the right file.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Karta podsumowania wypisu */}
            <div className="discharge-summary-card">
              <div className="discharge-summary-meta">
                {discharge.clinic_name && (
                  <span className="discharge-meta-item">
                    🏥 <strong>{discharge.clinic_name}</strong>
                  </span>
                )}
                {discharge.patient_name && (
                  <span className="discharge-meta-item">
                    🐾 {pl ? "Pacjent" : "Patient"}: <strong>{discharge.patient_name}</strong>
                  </span>
                )}
                {activePagesInfo && (
                  <span className="discharge-range-badge">
                    📄 {formatPagesSummary(activePagesInfo.pages, pl)}{" "}
                    {pl ? "z" : "of"} {activePagesInfo.total}
                  </span>
                )}
              </div>
              {discharge.summary && (
                <p className="discharge-summary-text">{discharge.summary}</p>
              )}
            </div>

            {/* Nawigacja po zakładkach */}
            <div className="discharge-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "labs"}
                className={`discharge-tab-btn${activeTab === "labs" ? " is-active" : ""}`}
                onClick={() => setActiveTab("labs")}
              >
                <IconFlask size={16} aria-hidden="true" />
                <span>{pl ? "Badania laboratoryjne & USG" : "Lab & Imaging Reports"}</span>
                <span className="discharge-tab-count">
                  {selectedLabsCount}/{totalLabsCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "events"}
                className={`discharge-tab-btn${activeTab === "events" ? " is-active" : ""}`}
                onClick={() => setActiveTab("events")}
              >
                <IconStethoscope size={16} aria-hidden="true" />
                <span>{pl ? "Wizyty & Zalecenia" : "Visits & Notes"}</span>
                <span className="discharge-tab-count">
                  {selectedEventsCount}/{totalEventsCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "weights"}
                className={`discharge-tab-btn${activeTab === "weights" ? " is-active" : ""}`}
                onClick={() => setActiveTab("weights")}
              >
                <IconScale size={16} aria-hidden="true" />
                <span>{pl ? "Waga & Pomiary" : "Weight & Vitals"}</span>
                <span className="discharge-tab-count">
                  {selectedWeightsCount}/{totalWeightsCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "meds"}
                className={`discharge-tab-btn${activeTab === "meds" ? " is-active" : ""}`}
                onClick={() => setActiveTab("meds")}
              >
                <IconPill size={16} aria-hidden="true" />
                <span>{pl ? "Zalecane leki" : "Prescribed Meds"}</span>
                <span className="discharge-tab-count">{discharge.medications.length}</span>
              </button>
            </div>

            {/* Zawartość wybranej zakładki */}
            <div className="discharge-tab-content">
              {/* TAB 1: Badania */}
              {activeTab === "labs" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      {pl ? (
                        <>
                          Wykryto <strong>{totalLabsCount}</strong> badań. Zaznacz pozycje, które chcesz
                          zapisać jako oficjalne wyniki w sekcji Badań.
                        </>
                      ) : (
                        <>
                          Found <strong>{totalLabsCount}</strong> reports. Select the items to save in
                          the Lab Results section.
                        </>
                      )}
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("labs", true)}
                      >
                        {pl ? "Zaznacz wszystkie" : "Select all"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("labs", false)}
                      >
                        {pl ? "Odznacz" : "Clear"}
                      </Button>
                    </div>
                  </div>

                  {discharge.lab_reports.length === 0 ? (
                    <p className="discharge-empty-hint">
                      {pl
                        ? "Brak wyodrębnionych badań w tym fragmencie dokumentu."
                        : "No lab or imaging reports extracted from these pages."}
                    </p>
                  ) : (
                    <div className="discharge-items-list">
                      {discharge.lab_reports.map((report) => {
                        const isExpanded = expandedReportId === report.id;
                        return (
                          <div
                            key={report.id}
                            className={`discharge-item-card${report.selected ? " is-selected" : ""}`}
                          >
                            <div className="discharge-item-header">
                              <label className="discharge-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={report.selected}
                                  onChange={() => toggleReport(report.id)}
                                />
                                <div>
                                  <strong className="discharge-item-title">{report.title}</strong>
                                  <div className="discharge-item-meta">
                                    <span>📅 {report.date}</span>
                                    {report.laboratory && <span>🔬 {report.laboratory}</span>}
                                    {report.doctor && <span>👨‍⚕️ {report.doctor}</span>}
                                    <span className="discharge-param-count">
                                      {report.parameters.length > 0
                                        ? pl
                                          ? `${report.parameters.length} parametrów`
                                          : `${report.parameters.length} parameters`
                                        : pl
                                          ? "Opis USG / obrazowe"
                                          : "Ultrasound / imaging note"}
                                    </span>
                                  </div>
                                </div>
                              </label>
                              <button
                                type="button"
                                className="discharge-expand-btn"
                                onClick={() =>
                                  setExpandedReportId(isExpanded ? null : report.id)
                                }
                                aria-label={
                                  isExpanded
                                    ? pl
                                      ? "Zwiń szczegóły"
                                      : "Collapse details"
                                    : pl
                                      ? "Rozwiń szczegóły"
                                      : "Expand details"
                                }
                              >
                                {isExpanded ? (
                                  <IconChevronUp size={18} />
                                ) : (
                                  <IconChevronDown size={18} />
                                )}
                              </button>
                            </div>

                            {/* Szczegóły badania */}
                            {isExpanded && (
                              <div className="discharge-item-details">
                                {report.ai_interpretation && (
                                  <div className="discharge-ai-note">
                                    <IconSparkles size={16} />
                                    <span>{report.ai_interpretation}</span>
                                  </div>
                                )}
                                {report.parameters.length > 0 && (
                                  <div className="discharge-table-wrapper">
                                    <table className="discharge-params-table">
                                      <thead>
                                        <tr>
                                          <th>{pl ? "Wskaźnik" : "Parameter"}</th>
                                          <th>{pl ? "Wartość" : "Value"}</th>
                                          <th>{pl ? "Norma" : "Reference"}</th>
                                          <th>{pl ? "Jednostka" : "Unit"}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {report.parameters.map((param, pIdx) => (
                                          <tr key={`${param.name}-${pIdx}`}>
                                            <td>
                                              <strong>{param.name}</strong>
                                            </td>
                                            <td>{param.value}</td>
                                            <td>{param.reference || "—"}</td>
                                            <td>{param.unit || "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {report.notes && (
                                  <div className="discharge-text-notes">
                                    <strong>
                                      {pl ? "Opis / Wnioski lekarza:" : "Findings / Vet notes:"}
                                    </strong>
                                    <FormattedMedicalText text={report.notes} />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Wizyty */}
              {activeTab === "events" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      {pl ? (
                        <>
                          Wykryto <strong>{totalEventsCount}</strong> wizyt leczniczych. Zostaną dodane
                          jako chronologiczne wpisy do Osi Czasu Zdrowia.
                        </>
                      ) : (
                        <>
                          Found <strong>{totalEventsCount}</strong> clinic events. They will be added
                          chronologically to the Health Timeline.
                        </>
                      )}
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("events", true)}
                      >
                        {pl ? "Zaznacz wszystkie" : "Select all"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("events", false)}
                      >
                        {pl ? "Odznacz" : "Clear"}
                      </Button>
                    </div>
                  </div>

                  {discharge.clinical_events.length === 0 ? (
                    <p className="discharge-empty-hint">
                      {pl
                        ? "Brak zarejestrowanych wizyt w tym dokumencie."
                        : "No clinic visits found in this document."}
                    </p>
                  ) : (
                    <div className="discharge-items-list">
                      {discharge.clinical_events.map((event) => {
                        const isExpanded = expandedEventId === event.id;
                        return (
                          <div
                            key={event.id}
                            className={`discharge-item-card${event.selected ? " is-selected" : ""}`}
                          >
                            <div className="discharge-item-header">
                              <label className="discharge-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={event.selected}
                                  onChange={() => toggleEvent(event.id)}
                                />
                                <div>
                                  <strong className="discharge-item-title">{event.title}</strong>
                                  <div className="discharge-item-meta">
                                    <span>📅 {event.date}</span>
                                    {event.clinic && <span>🏥 {event.clinic}</span>}
                                    {event.doctor && <span>👨‍⚕️ {event.doctor}</span>}
                                    <span className="discharge-category-pill">
                                      {event.category === "vaccination"
                                        ? pl
                                          ? "Szczepienie"
                                          : "Vaccination"
                                        : event.category === "prevention"
                                          ? pl
                                            ? "Profilaktyka"
                                            : "Prevention"
                                          : pl
                                            ? "Wizyta lecznicza"
                                            : "Clinic visit"}
                                    </span>
                                  </div>
                                </div>
                              </label>
                              {event.description && (
                                <button
                                  type="button"
                                  className="discharge-expand-btn"
                                  onClick={() =>
                                    setExpandedEventId(isExpanded ? null : event.id)
                                  }
                                  aria-label={
                                    isExpanded
                                      ? pl
                                        ? "Zwiń opis"
                                        : "Collapse description"
                                      : pl
                                        ? "Rozwiń opis"
                                        : "Expand description"
                                  }
                                >
                                  {isExpanded ? (
                                    <IconChevronUp size={18} />
                                  ) : (
                                    <IconChevronDown size={18} />
                                  )}
                                </button>
                              )}
                            </div>

                            {isExpanded && event.description && (
                              <div className="discharge-item-details">
                                <div className="discharge-text-notes">
                                  <strong>
                                    {pl
                                      ? "Przebieg wizyty i zalecenia:"
                                      : "Visit notes & recommendations:"}
                                  </strong>
                                  <FormattedMedicalText text={event.description} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Waga & Pomiary */}
              {activeTab === "weights" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      {pl ? (
                        <>
                          Wykryto <strong>{totalWeightsCount}</strong> pomiarów (waga, ciśnienie, temperatura) w dokumentacji.
                          Zostaną zsynchronizowane z profilem zdrowia pupila.
                        </>
                      ) : (
                        <>
                          Found <strong>{totalWeightsCount}</strong> measurements (weight, blood pressure, temperature).
                          They will be synced to the pet&apos;s health profile.
                        </>
                      )}
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("weights", true)}
                      >
                        {pl ? "Zaznacz wszystkie" : "Select all"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("weights", false)}
                      >
                        {pl ? "Odznacz" : "Clear"}
                      </Button>
                    </div>
                  </div>

                  {discharge.measurements.length === 0 ? (
                    <p className="discharge-empty-hint">
                      {pl
                        ? "Brak zarejestrowanych pomiarów w tym dokumencie."
                        : "No measurements found in this document."}
                    </p>
                  ) : (
                    <div className="discharge-weights-grid">
                      {discharge.measurements.map((meas) => {
                        const icon =
                          meas.type === "blood_pressure" ? "🩺 " : meas.type === "temperature" ? "🌡️ " : "⚖️ ";
                        const label =
                          meas.type === "blood_pressure"
                            ? meas.raw_value
                              ? `${pl ? "Ciśnienie" : "BP"}: ${meas.raw_value}`
                              : `${meas.value} mmHg`
                            : meas.type === "temperature"
                              ? meas.raw_value
                                ? `Temp: ${meas.raw_value}`
                                : `${meas.value} °C`
                              : meas.value
                                ? `${meas.value} kg`
                                : meas.raw_value;

                        return (
                          <label
                            key={meas.id}
                            className={`discharge-weight-chip${meas.selected ? " is-selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={meas.selected}
                              onChange={() => toggleMeasurement(meas.id)}
                            />
                            <div>
                              <span className="discharge-weight-value">
                                {icon}{label}
                              </span>
                              <span className="discharge-weight-date">📅 {meas.date}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Leki */}
              {activeTab === "meds" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      {pl
                        ? "Zalecane lub wydane leki w wypisie leczniczym (informacyjnie):"
                        : "Medications prescribed or dispensed in the discharge (informational):"}
                    </p>
                  </div>

                  {discharge.medications.length === 0 ? (
                    <p className="discharge-empty-hint">
                      {pl
                        ? "Brak zaleceń lekowych w tym dokumencie."
                        : "No medication recommendations found in this document."}
                    </p>
                  ) : (
                    <div className="discharge-items-list">
                      {discharge.medications.map((med, mIdx) => (
                        <div key={`${med.name}-${mIdx}`} className="discharge-med-card">
                          <div className="discharge-med-header">
                            <IconPill size={20} className="text-emerald-700" />
                            <strong>{med.name}</strong>
                          </div>
                          <div className="discharge-med-body">
                            {med.dosage && (
                              <div>
                                <strong>{pl ? "Dawka:" : "Dosage:"}</strong> {med.dosage}
                              </div>
                            )}
                            {med.frequency && (
                              <div>
                                <strong>{pl ? "Częstotliwość:" : "Frequency:"}</strong>{" "}
                                {med.frequency}
                              </div>
                            )}
                            {med.instructions && (
                              <div>
                                <strong>{pl ? "Zalecenia:" : "Instructions:"}</strong>{" "}
                                {med.instructions}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stopka zatwierdzenia */}
            <footer className="discharge-dialog-footer">
              <div className="discharge-footer-summary">
                <span>
                  {pl ? (
                    <>
                      Wybrano do importu: <strong>{totalSelected}</strong> pozycji
                    </>
                  ) : (
                    <>
                      Selected for import: <strong>{totalSelected}</strong>{" "}
                      {totalSelected === 1 ? "item" : "items"}
                    </>
                  )}
                </span>
              </div>
              <div className="discharge-footer-buttons">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={handleCloseDialog}
                >
                  {pl ? "Anuluj" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving || totalSelected === 0}
                  onClick={() => void handleConfirmImport()}
                >
                  {saving
                    ? pl
                      ? "Zapisywanie w kartotece…"
                      : "Saving to profile…"
                    : pl
                      ? `Zaimportuj (${totalSelected})`
                      : `Import (${totalSelected})`}
                </Button>
              </div>
            </footer>
          </div>
        )}

        {/* Krok 4: Sukces */}
        {step === "success" && (
          <div className="discharge-success-step">
            <div className="discharge-success-icon" aria-hidden="true">
              <IconCheck size={40} />
            </div>
            <h3>
              {pl
                ? "Wypis został pomyślnie zaimportowany!"
                : "Discharge imported successfully!"}
            </h3>
            <p className="discharge-success-stats">
              {pl ? "Zaktualizowano profil pupila o:" : "Updated pet profile with:"}
            </p>
            <div className="discharge-success-badges">
              <div className="discharge-stat-badge">
                <strong>{saveResult?.reports_count ?? 0}</strong>
                <span>{pl ? "badań laboratoryjnych / USG" : "lab / imaging reports"}</span>
              </div>
              <div className="discharge-stat-badge">
                <strong>{saveResult?.events_count ?? 0}</strong>
                <span>{pl ? "wpisów w Osi Czasu" : "timeline entries"}</span>
              </div>
              <div className="discharge-stat-badge">
                <strong>{(saveResult?.weights_count ?? 0) + (saveResult?.vitals_count ?? 0)}</strong>
                <span>{pl ? "pomiarów masy i parametrów" : "weight & vital logs"}</span>
              </div>
            </div>

            {/* Opcja kontynuacji kolejnej części jeśli dokument miał więcej stron */}
            {hasRemainingUnimportedPages && (
              <div className="discharge-remaining-chunk-banner">
                <div>
                  <strong>
                    {pl
                      ? "Dostępne kolejne strony dokumentu!"
                      : "More pages available in this document!"}
                  </strong>
                  <p>
                    {pl
                      ? `W pliku pozostały jeszcze niezaimportowane strony (pozostało ${remainingPagesCount} ${formatPagesCount(remainingPagesCount, true)}). Aplikacja zapamiętała już wybrane wcześniej strony.`
                      : `There are still unimported pages left in this file (${remainingPagesCount} ${formatPagesCount(remainingPagesCount, false)} remaining). The app remembered previously imported pages.`}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={handleNextChunkImport}>
                  <span>{pl ? "Zaimportuj pozostałe strony" : "Import remaining pages"}</span>
                  <IconArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            )}

            <div className="discharge-success-actions">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  handleCloseDialog();
                  window.location.reload();
                }}
              >
                {pl ? "Przejdź do kartoteki pupila" : "Go to pet profile"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
