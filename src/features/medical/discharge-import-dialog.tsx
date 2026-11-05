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
  extractClinicalDischarge,
} from "./discharge-import-service";
import type { DischargeParsedState } from "./discharge-types";
import { FormattedMedicalText } from "./formatted-text";
import {
  MAX_DISCHARGE_PAGES,
  computePageChunks,
  inspectPdf,
  slicePdfPages,
  type PageChunk,
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
  const [pageChunks, setPageChunks] = useState<PageChunk[]>([]);
  const [selectedMode, setSelectedMode] = useState<"all" | "chunk" | "custom">("all");
  const [selectedChunkId, setSelectedChunkId] = useState<string>("");
  const [customStart, setCustomStart] = useState<number>(1);
  const [customEnd, setCustomEnd] = useState<number>(1);
  const [activeRange, setActiveRange] = useState<{ start: number; end: number; total: number } | null>(null);

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
    setPageChunks([]);
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
      const info = await inspectPdf(selectedFile);
      setRawFile(selectedFile);
      setPdfInfo(info);

      const chunks = computePageChunks(info.pageCount, MAX_DISCHARGE_PAGES);
      setPageChunks(chunks);

      if (info.pageCount <= MAX_DISCHARGE_PAGES) {
        setSelectedMode("all");
        setCustomStart(1);
        setCustomEnd(info.pageCount);
      } else {
        setSelectedMode("chunk");
        setSelectedChunkId(chunks[0]?.id ?? "");
        setCustomStart(chunks[0]?.start ?? 1);
        setCustomEnd(chunks[0]?.end ?? Math.min(MAX_DISCHARGE_PAGES, info.pageCount));
      }

      setStep("configure");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Nie udało się odczytać struktury pliku PDF. Upewnij się, że plik nie jest uszkodzony.");
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

  async function handleStartExtraction() {
    if (!rawFile || !pdfInfo) return;

    let start = 1;
    let end = pdfInfo.pageCount;

    if (selectedMode === "all") {
      start = 1;
      end = pdfInfo.pageCount;
    } else if (selectedMode === "chunk") {
      const chunk = pageChunks.find((c) => c.id === selectedChunkId) || pageChunks[0];
      if (chunk) {
        start = chunk.start;
        end = chunk.end;
      }
    } else if (selectedMode === "custom") {
      start = customStart;
      end = customEnd;
    }

    const count = end - start + 1;
    if (start < 1 || end > pdfInfo.pageCount || end < start) {
      setError(`Nieprawidłowy zakres stron (podaj od 1 do ${pdfInfo.pageCount}).`);
      return;
    }
    if (count > MAX_DISCHARGE_PAGES) {
      setError(
        `Wybrany zakres obejmuje ${count} stron. Maksymalny limit jednorazowej analizy to ${MAX_DISCHARGE_PAGES} stron.`,
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

    const nextChunk = pageChunks.find((c) => c.start === nextStart) || {
      id: `chunk_${nextStart}`,
      label: `Strony ${nextStart}–${Math.min(nextStart + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount)}`,
      start: nextStart,
      end: Math.min(nextStart + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount),
      pageCount: Math.min(nextStart + MAX_DISCHARGE_PAGES - 1, pdfInfo.pageCount) - nextStart + 1,
    };

    setSelectedMode("chunk");
    setSelectedChunkId(nextChunk.id);
    setCustomStart(nextChunk.start);
    setCustomEnd(nextChunk.end);
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

  const selectedWeightsCount = discharge?.measurements.filter((m) => m.selected && m.type === "weight").length ?? 0;
  const totalWeightsCount = discharge?.measurements.filter((m) => m.type === "weight").length ?? 0;

  const totalSelected = selectedLabsCount + selectedEventsCount + selectedWeightsCount;

  const isNameMismatch = Boolean(
    discharge?.patient_name &&
      pet.imie &&
      !discharge.patient_name.toLowerCase().includes(pet.imie.toLowerCase()) &&
      !pet.imie.toLowerCase().includes(discharge.patient_name.toLowerCase()),
  );

  // Obliczenie aktualnie wybranej liczby stron w kroku konfiguracji
  const currentTargetCount =
    selectedMode === "all"
      ? (pdfInfo?.pageCount ?? 0)
      : selectedMode === "chunk"
      ? (pageChunks.find((c) => c.id === selectedChunkId)?.pageCount ?? 0)
      : Math.max(0, customEnd - customStart + 1);

  const isCustomRangeValid =
    selectedMode !== "custom" ||
    (customStart >= 1 &&
      customEnd <= (pdfInfo?.pageCount ?? 1) &&
      customEnd >= customStart &&
      customEnd - customStart + 1 <= MAX_DISCHARGE_PAGES);

  const customValidationError =
    selectedMode === "custom"
      ? customStart < 1
        ? "Strona początkowa musi wynosić co najmniej 1."
        : customEnd < customStart
        ? "Strona końcowa nie może być mniejsza od początkowej."
        : customEnd > (pdfInfo?.pageCount ?? 1)
        ? `Strona końcowa nie może przekraczać ${pdfInfo?.pageCount ?? 1}.`
        : customEnd - customStart + 1 > MAX_DISCHARGE_PAGES
        ? `Wybrano ${customEnd - customStart + 1} stron. Limit to ${MAX_DISCHARGE_PAGES} stron na jedną analizę.`
        : null
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
              <h3>{isInspecting ? "Sprawdzanie pliku PDF…" : "Przeciągnij lub kliknij, aby wgrać wypis"}</h3>
              <p>
                Obsługujemy wielostronicowe pliki PDF (np. z Klinika XP, Provet, Vet-Gabinet) do 12 MB.
                Zalecany limit jednorazowej analizy to 20 stron.
              </p>
              <div className="discharge-dropzone-features">
                <span>🩺 Badania krwi, moczu i USG</span>
                <span>📋 Wizyty i zalecenia lekarza</span>
                <span>⚖️ Chronologiczne pomiary wagi</span>
              </div>
            </div>
          </div>
        )}

        {/* Krok 1.5: Konfiguracja stron i limitów (Configure Step) */}
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

            {/* Komunikat o limicie stron */}
            {pdfInfo.pageCount <= MAX_DISCHARGE_PAGES ? (
              <div className="discharge-limit-notice">
                <IconCheck size={20} className="text-emerald-700 shrink-0" aria-hidden="true" />
                <div>
                  <strong>Dokument mieści się w limicie</strong>
                  <p>
                    Plik ma {pdfInfo.pageCount} stron (maksymalny rekomendowany limit to{" "}
                    {MAX_DISCHARGE_PAGES} stron). Możesz przeanalizować cały dokument naraz lub
                    wybrać konkretny fragment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="discharge-limit-notice is-warning">
                <IconAlertTriangle size={20} className="text-amber-800 shrink-0" aria-hidden="true" />
                <div>
                  <strong>Dokument wymaga podziału na części</strong>
                  <p>
                    Ten plik zawiera <strong>{pdfInfo.pageCount} stron</strong>. Aby zapewnić 100%
                    precyzji odczytu tabel i uniknąć limitu odpowiedzi AI, jednorazowo analizujemy do{" "}
                    <strong>{MAX_DISCHARGE_PAGES} stron</strong>. Wybierz część do przetworzenia
                    w tej turze:
                  </p>
                </div>
              </div>
            )}

            {/* Opcje wyboru zakresu */}
            <div className="discharge-range-options">
              <h4>Wybierz zakres stron do analizy:</h4>

              {/* Jeśli plik mieści się w 20 stronach, opcja "Cały plik" */}
              {pdfInfo.pageCount <= MAX_DISCHARGE_PAGES && (
                <div className="discharge-chunks-grid">
                  <button
                    type="button"
                    className={`discharge-chunk-card${selectedMode === "all" ? " is-selected" : ""}`}
                    onClick={() => setSelectedMode("all")}
                  >
                    <span className="discharge-chunk-title">
                      ✓ Cały dokument (strony 1–{pdfInfo.pageCount})
                    </span>
                    <span className="discharge-chunk-subtitle">
                      Kompletna ekstrakcja wszystkich {pdfInfo.pageCount} stron
                    </span>
                  </button>
                </div>
              )}

              {/* Jeśli plik ma więcej niż 20 stron, kafelki części */}
              {pdfInfo.pageCount > MAX_DISCHARGE_PAGES && (
                <div className="discharge-chunks-grid">
                  {pageChunks.map((chunk) => (
                    <button
                      key={chunk.id}
                      type="button"
                      className={`discharge-chunk-card${
                        selectedMode === "chunk" && selectedChunkId === chunk.id
                          ? " is-selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedMode("chunk");
                        setSelectedChunkId(chunk.id);
                        setCustomStart(chunk.start);
                        setCustomEnd(chunk.end);
                      }}
                    >
                      <span className="discharge-chunk-title">{chunk.label}</span>
                      <span className="discharge-chunk-subtitle">
                        {chunk.pageCount} stron do ekstrakcji
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Własny zakres stron */}
              <div
                className={`discharge-custom-range-card${
                  selectedMode === "custom" ? " is-selected" : ""
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="page_mode"
                    checked={selectedMode === "custom"}
                    onChange={() => setSelectedMode("custom")}
                  />
                  <span className="text-sm font-semibold">Własny zakres stron:</span>
                </label>
                <div className="discharge-custom-inputs">
                  <div className="discharge-input-group">
                    <span>Od:</span>
                    <input
                      type="number"
                      min={1}
                      max={pdfInfo.pageCount}
                      value={customStart}
                      disabled={selectedMode !== "custom"}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) setCustomStart(val);
                      }}
                    />
                  </div>
                  <div className="discharge-input-group">
                    <span>Do:</span>
                    <input
                      type="number"
                      min={customStart}
                      max={pdfInfo.pageCount}
                      value={customEnd}
                      disabled={selectedMode !== "custom"}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) setCustomEnd(val);
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    (maks. {MAX_DISCHARGE_PAGES} stron w jednej turze)
                  </span>
                </div>
                {customValidationError && (
                  <span className="discharge-range-validation-error">{customValidationError}</span>
                )}
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
                  {currentTargetCount === 1 ? "strona" : currentTargetCount < 5 ? "strony" : "stron"})
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
              <li className="is-active">Identyfikacja wizyt leczniczych i pomiarów wagi</li>
            </ul>
          </div>
        )}

        {/* Krok 3: Weryfikacja i podgląd (Review Wizard) */}
        {step === "review" && discharge && (
          <div className="discharge-review-step">
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
                <span className="discharge-tab-count">
                  {discharge.medications.length}
                </span>
              </button>
            </div>

            {/* Zawartość wybranej zakładki */}
            <div className="discharge-tab-content">
              {/* TAB 1: Badania */}
              {activeTab === "labs" && (
                <div className="discharge-tab-pane">
                  <div className="discharge-tab-header">
                    <p className="discharge-tab-description">
                      Wykryto <strong>{totalLabsCount}</strong> badań. Zaznacz pozycje, które chcesz zapisać jako oficjalne wyniki w sekcji Badań.
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
                    <p className="discharge-empty-hint">Brak wyodrębnionych badań w tym fragmencie dokumentu.</p>
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
                                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                aria-label={isExpanded ? "Zwiń szczegóły" : "Rozwiń szczegóły"}
                              >
                                {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
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
                                            <td><strong>{param.name}</strong></td>
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
                      Wykryto <strong>{totalEventsCount}</strong> wizyt leczniczych. Zostaną dodane jako chronologiczne wpisy do Osi Czasu Zdrowia.
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
                    <p className="discharge-empty-hint">Brak zarejestrowanych wizyt w tym dokumencie.</p>
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
                                  onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                  aria-label={isExpanded ? "Zwiń opis" : "Rozwiń opis"}
                                >
                                  {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
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
                      Wykryto <strong>{totalWeightsCount}</strong> pomiarów wagi w dokumentacji. Zostaną zsynchronizowane z wykresem masy ciała pupila.
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
                    <p className="discharge-empty-hint">Brak zarejestrowanych pomiarów wagi w tym dokumencie.</p>
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
                            {med.dosage && <div><strong>Dawka:</strong> {med.dosage}</div>}
                            {med.frequency && <div><strong>Częstotliwość:</strong> {med.frequency}</div>}
                            {med.instructions && <div><strong>Zalecenia:</strong> {med.instructions}</div>}
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
            <p className="discharge-success-stats">
              Zaktualizowano profil pupila o:
            </p>
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
                    Możesz od razu przejść do ich ekstrakcji.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleNextChunkImport}
                >
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
