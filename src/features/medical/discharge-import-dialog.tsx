"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
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
  getSuggestedNextRange,
  recordPdfImport,
  type ImportedPdfHistory,
} from "./pdf-history";
import {
  MAX_DISCHARGE_PAGES,
  inspectPdf,
  slicePdfPages,
  type PdfInfo,
} from "./pdf-page-utils";

interface DischargeImportDialogProps {
  pet: Pick<Pet, "id" | "imie"> & { gospodarstwo_id?: string };
  householdId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabKey = "labs" | "events" | "weights" | "meds";
type ImportStep = "upload" | "configure" | "analyzing" | "review" | "success";

export function DischargeImportDialog({
  pet,
  householdId,
  open,
  onClose,
  onSuccess,
}: DischargeImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const [step, setStep] = useState<ImportStep>("upload");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [rawSha256, setRawSha256] = useState<string>("");
  const [pdfHistory, setPdfHistory] = useState<ImportedPdfHistory | null>(null);

  const [customStart, setCustomStart] = useState<number>(1);
  const [customEnd, setCustomEnd] = useState<number>(1);
  const [activeRange, setActiveRange] = useState<{
    start: number;
    end: number;
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
  } | null>(null);

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
    setFile(null);
    setSha256("");
    setDischarge(null);
    setActiveRange(null);
    setError(null);
    setSaveResult(null);
  }

  function handleCloseDialog() {
    handleReset();
    onClose();
  }

  async function handleFileProcess(selectedFile: File) {
    if (selectedFile.type !== "application/pdf") {
      setError("Dozwolone są wyłącznie pliki PDF (np. wypis z kliniki).");
      return;
    }
    if (selectedFile.size > 12 * 1024 * 1024) {
      setError("Plik jest za duży (maksymalny rozmiar to 12 MB).");
      return;
    }

    setError(null);
    setIsInspecting(true);

    try {
      const [info, computedHash] = await Promise.all([
        inspectPdf(selectedFile),
        computeFileSha256(selectedFile),
      ]);

      setRawFile(selectedFile);
      setPdfInfo(info);
      setRawSha256(computedHash);

      const history = getPdfImportHistory(pet.id, computedHash);
      setPdfHistory(history);

      const suggested = getSuggestedNextRange(info.pageCount, history, MAX_DISCHARGE_PAGES);
      setCustomStart(suggested.start);
      setCustomEnd(suggested.end);

      setStep("configure");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg ||
          "Nie udało się odczytać struktury pliku PDF. Upewnij się, że plik nie jest uszkodzony.",
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

  function applyPresetRange(start: number, end: number) {
    if (!pdfInfo) return;
    const clampedStart = Math.max(1, Math.min(start, pdfInfo.pageCount));
    const clampedEnd = Math.max(clampedStart, Math.min(end, pdfInfo.pageCount));
    setCustomStart(clampedStart);
    setCustomEnd(clampedEnd);
    setError(null);
  }

  function handlePageClick(pageNumber: number) {
    if (!pdfInfo) return;
    // Jeśli kliknięto stronę po lewej lub obecny zakres był pełny, zresetuj początek
    if (pageNumber < customStart || customStart === customEnd) {
      const newEnd = Math.min(pageNumber + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount);
      setCustomStart(pageNumber);
      setCustomEnd(newEnd);
    } else {
      // Kliknięto stronę po prawej stronie od początku
      const count = pageNumber - customStart + 1;
      if (count <= MAX_DISCHARGE_PAGES) {
        setCustomEnd(pageNumber);
      } else {
        // Jeśli przekracza 20 stron, ustaw nowe okno 20 stron od klikniętej
        setCustomStart(pageNumber);
        setCustomEnd(Math.min(pageNumber + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount));
      }
    }
  }

  async function handleStartExtraction() {
    if (!rawFile || !pdfInfo) return;

    const start = customStart;
    const end = customEnd;
    const count = end - start + 1;

    if (start < 1 || end > pdfInfo.pageCount || end < start) {
      setError(`Nieprawidłowy zakres stron (podaj od 1 do ${pdfInfo.pageCount}).`);
      return;
    }
    if (count > MAX_DISCHARGE_PAGES) {
      setError(
        `Wybrany zakres obejmuje ${count} stron. Maksymalny dopuszczalny limit to ${MAX_DISCHARGE_PAGES} stron w jednej turze.`,
      );
      return;
    }

    setError(null);
    setStep("analyzing");

    try {
      const fileToProcess = await slicePdfPages(rawFile, start, end);
      setFile(fileToProcess);
      setActiveRange({ start, end, total: pdfInfo.pageCount });

      const result = await extractClinicalDischarge(pet.id, fileToProcess);
      setDischarge(result.discharge);
      setSha256(result.sha256);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Nie udało się przeanalizować wybranego fragmentu. Spróbuj ponownie.");
      setStep("configure");
    }
  }

  function handleNextChunkImport() {
    if (!rawFile || !pdfInfo || !activeRange) return;
    const nextStart = activeRange.end + 1;
    if (nextStart > pdfInfo.pageCount) return;

    const nextEnd = Math.min(nextStart + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount);
    setCustomStart(nextStart);
    setCustomEnd(nextEnd);

    // Refresh history
    const history = getPdfImportHistory(pet.id, rawSha256);
    setPdfHistory(history);

    setDischarge(null);
    setSaveResult(null);
    setFile(null);
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
      const effectiveHouseholdId = householdId || pet.gospodarstwo_id;
      if (!effectiveHouseholdId) {
        throw new Error("Brak identyfikatora gospodarstwa domowego.");
      }

      const res = await commitDischargeBatchImport({
        petId: pet.id,
        householdId: effectiveHouseholdId,
        file,
        sha256,
        state: discharge,
      });

      // Zapisz zaimportowany zakres w historii przeglądarki
      if (activeRange && rawSha256) {
        const updatedHistory = recordPdfImport(
          pet.id,
          rawSha256,
          rawFile?.name || file.name,
          activeRange.start,
          activeRange.end,
        );
        if (updatedHistory) setPdfHistory(updatedHistory);
      }

      setSaveResult(res);
      setStep("success");
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Wystąpił błąd podczas zapisywania danych do kartoteki.");
    } finally {
      setSaving(false);
    }
  }

  const selectedLabsCount = discharge?.lab_reports.filter((r) => r.selected).length ?? 0;
  const totalLabsCount = discharge?.lab_reports.length ?? 0;

  const selectedEventsCount = discharge?.clinical_events.filter((e) => e.selected).length ?? 0;
  const totalEventsCount = discharge?.clinical_events.length ?? 0;

  const selectedWeightsCount =
    discharge?.measurements.filter((m) => m.selected && m.type === "weight").length ?? 0;
  const totalWeightsCount =
    discharge?.measurements.filter((m) => m.type === "weight").length ?? 0;

  const totalSelected = selectedLabsCount + selectedEventsCount + selectedWeightsCount;

  const isNameMismatch = Boolean(
    discharge?.patient_name &&
      pet.imie &&
      !discharge.patient_name.toLowerCase().includes(pet.imie.toLowerCase()) &&
      !pet.imie.toLowerCase().includes(discharge.patient_name.toLowerCase()),
  );

  // Wyliczenie stron w selektorze
  const currentTargetCount = Math.max(0, customEnd - customStart + 1);
  const isCustomRangeValid =
    customStart >= 1 &&
    pdfInfo !== null &&
    customEnd <= pdfInfo.pageCount &&
    customEnd >= customStart &&
    customEnd - customStart + 1 <= MAX_DISCHARGE_PAGES;

  const importedSet = new Set(pdfHistory?.allImportedPages || []);
  const suggestedRange = pdfInfo
    ? getSuggestedNextRange(pdfInfo.pageCount, pdfHistory, MAX_DISCHARGE_PAGES)
    : null;

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
              Inteligentny Importer Wypisów z Lecznicy
            </h2>
            <p className="discharge-dialog-subtitle">
              Rozpoznaj i podziel wielostronicowy wyciąg leczenia na badania, wizyty i wagę pupila.
            </p>
          </div>
          <button
            type="button"
            className="discharge-close-btn"
            onClick={handleCloseDialog}
            disabled={saving || step === "analyzing"}
            aria-label="Zamknij"
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
                {isInspecting ? "Sprawdzanie pliku PDF…" : "Przeciągnij lub kliknij, aby wgrać wypis"}
              </h3>
              <p>
                Obsługujemy wielostronicowe pliki PDF (np. z Klinika XP, Provet, Vet-Gabinet) do 12 MB.
                Jednorazowy limit analizy to 20 stron.
              </p>
              <div className="discharge-dropzone-features">
                <span>🩺 Badania krwi, moczu i USG</span>
                <span>📋 Wizyty i zalecenia lekarza</span>
                <span>⚖️ Chronologiczne pomiary wagi</span>
              </div>
            </div>
          </div>
        )}

        {/* Krok 1.5: Konfiguracja i wybór stron (Configure Step) */}
        {step === "configure" && pdfInfo && (
          <div className="discharge-configure-step">
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
                    📄 {pdfInfo.pageCount}{" "}
                    {pdfInfo.pageCount === 1
                      ? "strona"
                      : pdfInfo.pageCount < 5
                      ? "strony"
                      : "stron"}
                  </span>
                </div>
              </div>
            </div>

            {/* Ostrzeżenie i szczegółowa instrukcja dla opiekuna gdy > 20 stron */}
            {pdfInfo.pageCount > MAX_DISCHARGE_PAGES ? (
              <div className="discharge-oversize-guide">
                <div className="discharge-guide-header">
                  <IconAlertTriangle size={24} className="text-amber-800 shrink-0" aria-hidden="true" />
                  <div>
                    <h4>Dokument ma {pdfInfo.pageCount} stron — wybierz zakres stron do analizy</h4>
                    <p>
                      Ze względu na techniczne limity wielkości odpowiedzi modeli AI oraz ciągłość
                      badań laboratoryjnych, jednorazowo analizujemy do <strong>20 stron</strong>.
                      W ten sposób chronimy wyniki badań i opisy wizyt przed przypadkowym ucięciem
                      w połowie.
                    </p>
                  </div>
                </div>

                <div className="discharge-guide-steps">
                  <div className="discharge-step-item">
                    <span className="discharge-step-number">1</span>
                    <div>
                      <strong>Zaznacz zakres stron do analizy w tej turze</strong>
                      <p>
                        Wybierz do 20 stron (np. od początku lub do końca konkretnego panelu badań).
                      </p>
                    </div>
                  </div>
                  <div className="discharge-step-item">
                    <span className="discharge-step-number">2</span>
                    <div>
                      <strong>Zaimportuj pozostałe strony w kolejnym kroku</strong>
                      <p>
                        Po zapisaniu możesz wybrać ten sam plik ponownie – aplikacja pamięta, które
                        strony już dodano, i podpowie kolejny fragment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="discharge-guide-tip">
                  <IconInfoCircle size={16} aria-hidden="true" />
                  <span>
                    <strong>Wskazówka:</strong> Zwróć uwagę, czy badanie nie zaczyna się na końcu
                    strony – lepiej zakończyć partię przed rozpoczęciem nowego badania, a kolejne
                    zacząć od nowej strony.
                  </span>
                </div>
              </div>
            ) : (
              <div className="discharge-limit-notice">
                <IconCheck size={20} className="text-emerald-700 shrink-0" aria-hidden="true" />
                <div>
                  <strong>Dokument mieści się w limicie</strong>
                  <p>
                    Plik ma {pdfInfo.pageCount} stron (mieści się w limicie {MAX_DISCHARGE_PAGES}{" "}
                    stron). Możesz przeanalizować cały plik naraz lub wybrać określony fragment.
                  </p>
                </div>
              </div>
            )}

            {/* Sekcja historii wcześniejszych importów tego pliku */}
            {pdfHistory && pdfHistory.importedRanges.length > 0 && (
              <div className="discharge-history-card">
                <div className="discharge-history-header">
                  <IconHistory size={18} className="text-emerald-700 shrink-0" aria-hidden="true" />
                  <div className="discharge-history-content">
                    <strong>Wcześniej zaimportowano już strony z tego pliku:</strong>
                    <div className="discharge-history-ranges">
                      {pdfHistory.importedRanges.map((r, idx) => (
                        <span key={`${r.start}-${r.end}-${idx}`} className="discharge-history-tag">
                          ✓ Strony {r.start}–{r.end}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {suggestedRange && suggestedRange.hasUnimported && (
                  <button
                    type="button"
                    className="discharge-suggested-btn"
                    onClick={() => applyPresetRange(suggestedRange.start, suggestedRange.end)}
                  >
                    <span>Zaznacz sugerowane kolejne strony ({suggestedRange.start}–{suggestedRange.end})</span>
                    <IconArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {/* Interaktywny selektor stron */}
            <div className="discharge-range-selector-box">
              <div className="discharge-selector-header">
                <h4>Wybór stron do ekstrakcji:</h4>
                <div className="discharge-quick-presets">
                  {pdfInfo.pageCount <= MAX_DISCHARGE_PAGES ? (
                    <button
                      type="button"
                      className="discharge-preset-pill"
                      onClick={() => applyPresetRange(1, pdfInfo.pageCount)}
                    >
                      Wszystkie strony (1–{pdfInfo.pageCount})
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="discharge-preset-pill"
                        onClick={() => applyPresetRange(1, Math.min(20, pdfInfo.pageCount))}
                      >
                        Część 1 (str. 1–{Math.min(20, pdfInfo.pageCount)})
                      </button>
                      {pdfInfo.pageCount > 20 && (
                        <button
                          type="button"
                          className="discharge-preset-pill"
                          onClick={() =>
                            applyPresetRange(21, Math.min(40, pdfInfo.pageCount))
                          }
                        >
                          Część 2 (str. 21–{Math.min(40, pdfInfo.pageCount)})
                        </button>
                      )}
                      {suggestedRange && suggestedRange.hasUnimported && (
                        <button
                          type="button"
                          className="discharge-preset-pill is-suggested"
                          onClick={() => applyPresetRange(suggestedRange.start, suggestedRange.end)}
                        >
                          Pozostałe ({suggestedRange.start}–{suggestedRange.end})
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Wizualna mapa kafelków stron */}
              <div className="discharge-page-strip" role="group" aria-label="Kafelki stron">
                {Array.from({ length: pdfInfo.pageCount }, (_, i) => i + 1).map((pNum) => {
                  const isImported = importedSet.has(pNum);
                  const isSelected = pNum >= customStart && pNum <= customEnd;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`discharge-page-pill${isImported ? " is-imported" : ""}${
                        isSelected ? " is-selected" : ""
                      }`}
                      onClick={() => handlePageClick(pNum)}
                      title={`Strona ${pNum}${isImported ? " (już zaimportowana)" : ""}`}
                    >
                      <span>{pNum}</span>
                      {isImported && <IconCheck size={10} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <div className="discharge-strip-legend">
                <span>
                  <span className="discharge-legend-dot is-imported" /> Już zaimportowane
                </span>
                <span>
                  <span className="discharge-legend-dot is-selected" /> Wybrane do bieżącej analizy
                </span>
                <span>
                  <span className="discharge-legend-dot" /> Dostępne
                </span>
              </div>

              {/* Pola numeryczne Od / Do */}
              <div className="discharge-inputs-row">
                <div className="discharge-input-inline">
                  <label htmlFor="range-start">Od strony:</label>
                  <input
                    id="range-start"
                    type="number"
                    min={1}
                    max={pdfInfo.pageCount}
                    value={customStart}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isNaN(val)) setCustomStart(val);
                    }}
                  />
                </div>
                <div className="discharge-input-inline">
                  <label htmlFor="range-end">Do strony:</label>
                  <input
                    id="range-end"
                    type="number"
                    min={customStart}
                    max={pdfInfo.pageCount}
                    value={customEnd}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isNaN(val)) setCustomEnd(val);
                    }}
                  />
                </div>

                <div className="discharge-target-summary">
                  {currentTargetCount > MAX_DISCHARGE_PAGES ? (
                    <span className="text-red-700 font-bold">
                      ⚠️ Wybrano {currentTargetCount} stron (maks. {MAX_DISCHARGE_PAGES} stron / turę)
                    </span>
                  ) : currentTargetCount > 0 ? (
                    <span className="text-emerald-800 font-semibold">
                      ✓ Wybrano {currentTargetCount}{" "}
                      {currentTargetCount === 1
                        ? "stronę"
                        : currentTargetCount < 5
                        ? "strony"
                        : "stron"}{" "}
                      (strony {customStart}–{customEnd})
                    </span>
                  ) : (
                    <span className="text-red-600">Nieprawidłowy zakres stron</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stopka konfiguracji */}
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
                Wybierz inny plik
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!isCustomRangeValid || currentTargetCount === 0}
                onClick={() => void handleStartExtraction()}
              >
                <IconSparkles size={16} aria-hidden="true" />
                <span>
                  Rozpocznij analizę ({currentTargetCount}{" "}
                  {currentTargetCount === 1
                    ? "strona"
                    : currentTargetCount < 5
                    ? "strony"
                    : "stron"}
                  )
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Krok 2: Analiza AI */}
        {step === "analyzing" && (
          <div className="discharge-analyzing-step">
            <div className="discharge-spinner-pulse" aria-hidden="true">
              <IconSparkles size={32} />
            </div>
            <h3>Sztuczna inteligencja analizuje dokument…</h3>
            <p className="discharge-analyzing-hint">
              Wielostronicowe wypisy analizujemy za pomocą multimodalnego modelu Gemini.
            </p>
            <ul className="discharge-analyzing-steps">
              <li className="is-active">
                Wczytywanie stron dokumentu ({file?.name}
                {activeRange && (
                  <span>
                    , strony {activeRange.start}–{activeRange.end} z {activeRange.total}
                  </span>
                )}
                )
              </li>
              <li className="is-active">Wyodrębnianie dat, parametrów laboratoryjnych i opisów USG</li>
              <li className="is-active">Weryfikacja ciągłości badań i pomiarów wagi</li>
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
                  <strong>Uwaga: badanie ucięte na końcu wybranego zakresu!</strong>
                  <p>{discharge.boundary_alert.cut_off_description}</p>
                  <p className="discharge-boundary-tip">
                    💡 Wskazówka: Przy kolejnym imporcie zalecamy uwzględnić stronę{" "}
                    <strong>{activeRange?.end}</strong> jako stronę początkową nowej partii, aby
                    model scalił to badanie w całości bez brakujących parametrów.
                  </p>
                </div>
              </div>
            )}

            {/* Ostrzeżenie o niezgodności imienia pupila */}
            {isNameMismatch && (
              <div className="discharge-warning-banner">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>Uwaga dotycząca pacjenta:</strong>
                  <p>
                    Dokument wskazuje pacjenta <strong>&quot;{discharge.patient_name}&quot;</strong>,
                    podczas gdy aktualna kartoteka należy do pupila <strong>&quot;{pet.imie}&quot;</strong>.
                    Upewnij się, że wgrywasz właściwy dokument.
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
                    🐾 Pacjent: <strong>{discharge.patient_name}</strong>
                  </span>
                )}
                {activeRange && (
                  <span className="discharge-range-badge">
                    📄 Strony {activeRange.start}–{activeRange.end} z {activeRange.total}
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
                <span>Badania laboratoryjne &amp; USG</span>
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
                <span>Wizyty &amp; Zalecenia</span>
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
                <span>Waga &amp; Pomiary</span>
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
                <span>Zalecane leki</span>
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
                      Wykryto <strong>{totalLabsCount}</strong> badań. Zaznacz pozycje, które chcesz
                      zapisać jako oficjalne wyniki w sekcji Badań.
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("labs", true)}
                      >
                        Zaznacz wszystkie
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("labs", false)}
                      >
                        Odznacz
                      </Button>
                    </div>
                  </div>

                  {discharge.lab_reports.length === 0 ? (
                    <p className="discharge-empty-hint">
                      Brak wyodrębnionych badań w tym fragmencie dokumentu.
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
                                        ? `${report.parameters.length} parametrów`
                                        : "Opis USG / obrazowe"}
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
                                aria-label={isExpanded ? "Zwiń szczegóły" : "Rozwiń szczegóły"}
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
                                          <th>Wskaźnik</th>
                                          <th>Wartość</th>
                                          <th>Norma</th>
                                          <th>Jednostka</th>
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
                                    <strong>Opis / Wnioski lekarza:</strong>
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
                      Wykryto <strong>{totalEventsCount}</strong> wizyt leczniczych. Zostaną dodane
                      jako chronologiczne wpisy do Osi Czasu Zdrowia.
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("events", true)}
                      >
                        Zaznacz wszystkie
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("events", false)}
                      >
                        Odznacz
                      </Button>
                    </div>
                  </div>

                  {discharge.clinical_events.length === 0 ? (
                    <p className="discharge-empty-hint">
                      Brak zarejestrowanych wizyt w tym dokumencie.
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
                                        ? "Szczepienie"
                                        : event.category === "prevention"
                                        ? "Profilaktyka"
                                        : "Wizyta lecznicza"}
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
                                  aria-label={isExpanded ? "Zwiń opis" : "Rozwiń opis"}
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
                                  <strong>Przebieg wizyty i zalecenia:</strong>
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

              {/* TAB 3: Waga */}
              {activeTab === "weights" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      Wykryto <strong>{totalWeightsCount}</strong> pomiarów wagi w dokumentacji.
                      Zostaną zsynchronizowane z wykresem masy ciała pupila.
                    </p>
                    <div className="discharge-tab-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("weights", true)}
                      >
                        Zaznacz wszystkie
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toggleAllInTab("weights", false)}
                      >
                        Odznacz
                      </Button>
                    </div>
                  </div>

                  {discharge.measurements.filter((m) => m.type === "weight").length === 0 ? (
                    <p className="discharge-empty-hint">
                      Brak zarejestrowanych pomiarów wagi w tym dokumencie.
                    </p>
                  ) : (
                    <div className="discharge-weights-grid">
                      {discharge.measurements
                        .filter((m) => m.type === "weight")
                        .map((meas) => (
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
                                {meas.value ? `${meas.value} kg` : meas.raw_value}
                              </span>
                              <span className="discharge-weight-date">📅 {meas.date}</span>
                            </div>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Leki */}
              {activeTab === "meds" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      Zalecane lub wydane leki w wypisie leczniczym (informacyjnie):
                    </p>
                  </div>

                  {discharge.medications.length === 0 ? (
                    <p className="discharge-empty-hint">Brak zaleceń lekowych w tym dokumencie.</p>
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
                                <strong>Dawka:</strong> {med.dosage}
                              </div>
                            )}
                            {med.frequency && (
                              <div>
                                <strong>Częstotliwość:</strong> {med.frequency}
                              </div>
                            )}
                            {med.instructions && (
                              <div>
                                <strong>Zalecenia:</strong> {med.instructions}
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
                  Wybrano do importu: <strong>{totalSelected}</strong> pozycji
                </span>
              </div>
              <div className="discharge-footer-buttons">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={handleCloseDialog}
                >
                  Anuluj
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving || totalSelected === 0}
                  onClick={() => void handleConfirmImport()}
                >
                  {saving ? "Zapisywanie w kartotece…" : `Zaimportuj (${totalSelected})`}
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
            <h3>Wypis został pomyślnie zaimportowany!</h3>
            <p className="discharge-success-stats">Zaktualizowano profil pupila o:</p>
            <div className="discharge-success-badges">
              <div className="discharge-stat-badge">
                <strong>{saveResult?.reports_count ?? 0}</strong>
                <span>badań laboratoryjnych / USG</span>
              </div>
              <div className="discharge-stat-badge">
                <strong>{saveResult?.events_count ?? 0}</strong>
                <span>wpisów w Osi Czasu</span>
              </div>
              <div className="discharge-stat-badge">
                <strong>{saveResult?.weights_count ?? 0}</strong>
                <span>pomiarów masy ciała</span>
              </div>
            </div>

            {/* Opcja kontynuacji kolejnej części jeśli dokument miał więcej stron */}
            {activeRange && activeRange.end < activeRange.total && (
              <div className="discharge-remaining-chunk-banner">
                <div>
                  <strong>Dostępna kolejna część dokumentu!</strong>
                  <p>
                    W pliku pozostały jeszcze strony {activeRange.end + 1}–{activeRange.total}.
                    Aplikacja zapamiętała już zaimportowane strony {activeRange.start}–{activeRange.end}.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={handleNextChunkImport}>
                  <span>Zaimportuj kolejną część</span>
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
                Przejdź do kartoteki pupila
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
