"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
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

interface DischargeImportDialogProps {
  pet: Pick<Pet, "id" | "imie"> & { gospodarstwo_id?: string };
  householdId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabKey = "labs" | "events" | "weights" | "meds";

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

  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "success">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sha256, setSha256] = useState<string>("");
  const [discharge, setDischarge] = useState<DischargeParsedState | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("labs");
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
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

  async function handleFileProcess(selectedFile: File) {
    if (selectedFile.type !== "application/pdf") {
      setError("Dozwolone są wyłącznie pliki PDF (np. wypis z kliniki).");
      return;
    }
    if (selectedFile.size > 12 * 1024 * 1024) {
      setError("Plik jest za duży (maksymalny rozmiar to 12 MB).");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStep("analyzing");

    try {
      const result = await extractClinicalDischarge(pet.id, selectedFile);
      setDischarge(result.discharge);
      setSha256(result.sha256);
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Nie udało się przeanalizować pliku. Spróbuj ponownie.");
      setStep("upload");
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

  return (
    <dialog
      ref={dialogRef}
      className="discharge-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (saving || step === "analyzing") {
          e.preventDefault();
        } else {
          onClose();
        }
      }}
    >
      <div className="discharge-dialog-container">
        {/* Header */}
        <header className="discharge-dialog-header">
          <div className="discharge-header-content">
            <span className="discharge-badge-ai">
              <IconSparkles size={14} aria-hidden="true" />
              <span>Gemini 2.0 Flash</span>
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
            onClick={onClose}
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
                <IconUpload size={36} aria-hidden="true" />
              </div>
              <h3>Przeciągnij lub kliknij, aby wgrać wypis</h3>
              <p>Obsługujemy wielostronicowe pliki PDF (np. z Klinika XP, Provet, Vet-Gabinet) do 12 MB.</p>
              <div className="discharge-dropzone-features">
                <span>🩺 Badania krwi, moczu i USG</span>
                <span>📋 Wizyty i zalecenia lekarza</span>
                <span>⚖️ Chronologiczne pomiary wagi</span>
              </div>
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
              Wielostronicowe wypisy analizujemy w całości za pomocą modelu multimodalnego Gemini.
            </p>
            <ul className="discharge-analyzing-steps">
              <li className="is-active">Wczytywanie stron dokumentu PDF ({file?.name})</li>
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
                <span>Badania lab i USG</span>
                <span className="discharge-tab-badge">
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
                <span>Wizyty i zabiegi</span>
                <span className="discharge-tab-badge">
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
                <span>Waga pupila</span>
                <span className="discharge-tab-badge">
                  {selectedWeightsCount}/{totalWeightsCount}
                </span>
              </button>

              {discharge.medications.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "meds"}
                  className={`discharge-tab-btn${activeTab === "meds" ? " is-active" : ""}`}
                  onClick={() => setActiveTab("meds")}
                >
                  <IconPill size={16} aria-hidden="true" />
                  <span>Zalecone leki ({discharge.medications.length})</span>
                </button>
              )}
            </div>

            {/* Zawartość wybranej zakładki */}
            <div className="discharge-tab-content">
              {/* Tab: Badania laboratoryjne */}
              {activeTab === "labs" && (
                <div className="discharge-items-list">
                  <div className="discharge-list-actions">
                    <span className="discharge-list-hint">
                      Zaznacz badania, które mają zostać dodane jako osobne karty w module Wyniki Badań.
                    </span>
                    <div className="discharge-toggle-buttons">
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("labs", true)}
                        className="discharge-mini-action"
                      >
                        Zaznacz wszystkie
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("labs", false)}
                        className="discharge-mini-action"
                      >
                        Odznacz wszystkie
                      </button>
                    </div>
                  </div>

                  {discharge.lab_reports.length === 0 ? (
                    <p className="discharge-empty-hint">Nie wykryto badań laboratoryjnych ani obrazowych.</p>
                  ) : (
                    discharge.lab_reports.map((report) => {
                      const isExpanded = expandedReportId === report.id;
                      return (
                        <div
                          key={report.id}
                          className={`discharge-item-card${report.selected ? " is-selected" : ""}`}
                        >
                          <div className="discharge-item-header">
                            <label className="discharge-item-checkbox">
                              <input
                                type="checkbox"
                                checked={report.selected}
                                onChange={() => toggleReport(report.id)}
                              />
                              <span className="discharge-item-date">{report.date}</span>
                            </label>

                            <div className="discharge-item-title-col">
                              <strong>{report.title}</strong>
                              <span className="discharge-item-sub">
                                {report.laboratory ? `Laboratorium: ${report.laboratory}` : ""}
                                {report.parameters.length > 0
                                  ? ` • ${report.parameters.length} parametrów`
                                  : " • Opis opisowy (USG/obrazowe)"}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="discharge-expand-btn"
                              onClick={() =>
                                setExpandedReportId(isExpanded ? null : report.id)
                              }
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <IconChevronUp size={16} />
                              ) : (
                                <IconChevronDown size={16} />
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="discharge-item-expanded">
                              {report.parameters.length > 0 && (
                                <table className="discharge-parameters-table">
                                  <thead>
                                    <tr>
                                      <th>Parametr</th>
                                      <th>Wartość</th>
                                      <th>Jednostka</th>
                                      <th>Norma</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {report.parameters.map((p, idx) => (
                                      <tr key={idx}>
                                        <td>{p.name}</td>
                                        <td>
                                          <strong>{p.value}</strong>
                                        </td>
                                        <td>{p.unit}</td>
                                        <td>{p.reference}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {report.notes && (
                                <div className="discharge-notes-preview">
                                  <strong>Opis badania / wnioski:</strong>
                                  <FormattedMedicalText text={report.notes} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab: Wizyty i zabiegi */}
              {activeTab === "events" && (
                <div className="discharge-items-list">
                  <div className="discharge-list-actions">
                    <span className="discharge-list-hint">
                      Zaznacz wpisy, które mają zasilić Oś Czasu (Historię Zdrowia) pupila.
                    </span>
                    <div className="discharge-toggle-buttons">
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("events", true)}
                        className="discharge-mini-action"
                      >
                        Zaznacz wszystkie
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("events", false)}
                        className="discharge-mini-action"
                      >
                        Odznacz wszystkie
                      </button>
                    </div>
                  </div>

                  {discharge.clinical_events.length === 0 ? (
                    <p className="discharge-empty-hint">Nie wykryto odrębnych wpisów z wizyt klinicznych.</p>
                  ) : (
                    discharge.clinical_events.map((ev) => {
                      const isExpanded = expandedEventId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className={`discharge-item-card${ev.selected ? " is-selected" : ""}`}
                        >
                          <div className="discharge-item-header">
                            <label className="discharge-item-checkbox">
                              <input
                                type="checkbox"
                                checked={ev.selected}
                                onChange={() => toggleEvent(ev.id)}
                              />
                              <span className="discharge-item-date">{ev.date}</span>
                            </label>

                            <div className="discharge-item-title-col">
                              <strong>{ev.title}</strong>
                              <span className="discharge-item-sub">
                                {ev.doctor ? `Lekarz: ${ev.doctor}` : ""}
                                {ev.clinic ? ` • ${ev.clinic}` : ""}
                              </span>
                            </div>

                            {ev.description && (
                              <button
                                type="button"
                                className="discharge-expand-btn"
                                onClick={() =>
                                  setExpandedEventId(isExpanded ? null : ev.id)
                                }
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? (
                                  <IconChevronUp size={16} />
                                ) : (
                                  <IconChevronDown size={16} />
                                )}
                              </button>
                            )}
                          </div>

                          {isExpanded && ev.description && (
                            <div className="discharge-item-expanded">
                              <p className="discharge-desc-preview">{ev.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab: Pomiary wagi */}
              {activeTab === "weights" && (
                <div className="discharge-items-list">
                  <div className="discharge-list-actions">
                    <span className="discharge-list-hint">
                      Wykryte pomiary masy ciała i parametry życiowe z kolejnych dni wizyt.
                    </span>
                    <div className="discharge-toggle-buttons">
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("weights", true)}
                        className="discharge-mini-action"
                      >
                        Zaznacz wszystkie
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAllInTab("weights", false)}
                        className="discharge-mini-action"
                      >
                        Odznacz wszystkie
                      </button>
                    </div>
                  </div>

                  {discharge.measurements.length === 0 ? (
                    <p className="discharge-empty-hint">Nie wykryto pomiarów wagi ani ciśnienia.</p>
                  ) : (
                    <div className="discharge-weights-grid">
                      {discharge.measurements.map((m) => (
                        <label
                          key={m.id}
                          className={`discharge-weight-card${m.selected ? " is-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={m.selected}
                            onChange={() => toggleMeasurement(m.id)}
                          />
                          <div className="discharge-weight-info">
                            <span className="discharge-weight-date">{m.date}</span>
                            <span className="discharge-weight-val">
                              {m.type === "weight" ? `${m.value} kg` : m.raw_value}
                            </span>
                            <span className="discharge-weight-type">
                              {m.type === "weight"
                                ? "Masa ciała"
                                : m.type === "blood_pressure"
                                  ? "Ciśnienie krwi"
                                  : "Temperatura"}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Leki zalecone */}
              {activeTab === "meds" && (
                <div className="discharge-items-list">
                  <p className="discharge-list-hint">
                    Zalecone w dokumencie leki i preparaty. Informacje poglądowe – możesz je dodać do terminarza dawek.
                  </p>
                  <div className="discharge-meds-grid">
                    {discharge.medications.map((med, idx) => (
                      <div key={idx} className="discharge-med-card">
                        <div className="discharge-med-title">
                          <IconPill size={16} />
                          <strong>{med.name}</strong>
                        </div>
                        <div className="discharge-med-meta">
                          {med.dosage && <span>Dawka: <strong>{med.dosage}</strong></span>}
                          {med.frequency && <span>Częstotliwość: <strong>{med.frequency}</strong></span>}
                        </div>
                        {med.instructions && (
                          <p className="discharge-med-inst">{med.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stopka akcji */}
            <footer className="discharge-dialog-footer">
              <div className="discharge-footer-summary">
                <span>
                  Łącznie do zaimportowania: <strong>{totalSelected}</strong> poz.
                </span>
              </div>
              <div className="discharge-footer-buttons">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={onClose}
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
            <div className="discharge-success-actions">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onClose();
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
