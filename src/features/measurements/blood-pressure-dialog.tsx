"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconHeartRateMonitor,
  IconX,
  IconInfoCircle,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { saveVitalMeasurement } from "./actions";
import { getBloodPressureStage, type VitalMeasurement } from "./types";

const CONTEXT_OPTIONS = [
  { value: "vet_calm", labelPl: "W gabinecie – pupil spokojny", labelEn: "In clinic – calm" },
  { value: "vet_stress", labelPl: "W gabinecie – stres / biały fartuch", labelEn: "In clinic – stressed" },
  { value: "home", labelPl: "Pomiar domowy", labelEn: "Home measurement" },
  { value: "doppler", labelPl: "Metoda Dopplera", labelEn: "Doppler method" },
  { value: "oscillometric", labelPl: "Oscylometria (HDO / cyfrowa)", labelEn: "Oscillometric (HDO)" },
  { value: "other", labelPl: "Inne okoliczności", labelEn: "Other circumstances" },
];

export function BloodPressureDialog({
  petId,
  petName,
  measurement,
  onClose,
  onSave,
}: {
  petId: string;
  petName: string;
  measurement: VitalMeasurement | null;
  onClose: () => void;
  onSave: (row: VitalMeasurement) => void;
}) {
  const pl = useLocale() === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  const [sap, setSap] = useState(measurement ? String(measurement.value_primary) : "");
  const [dap, setDap] = useState(
    measurement?.value_secondary ? String(measurement.value_secondary) : ""
  );
  const [hr, setHr] = useState(
    measurement?.value_tertiary ? String(measurement.value_tertiary) : ""
  );

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const [date, setDate] = useState(measurement?.measured_on ?? todayIso);
  const [time, setTime] = useState(() => {
    if (measurement?.measured_at) {
      try {
        return new Date(measurement.measured_at).toISOString().slice(11, 16);
      } catch {
        return "12:00";
      }
    }
    return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }).slice(0, 5);
  });

  const [context, setContext] = useState(measurement?.context ?? "vet_calm");
  const [note, setNote] = useState(measurement?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const numSap = Number(sap.replace(",", "."));
  const numDap = dap ? Number(dap.replace(",", ".")) : null;
  const numHr = hr ? Number(hr.replace(",", ".")) : null;

  const sapValid = !isNaN(numSap) && numSap >= 40 && numSap <= 300;
  const dapValid = numDap === null || (!isNaN(numDap) && numDap >= 20 && numDap < numSap);
  const hrValid = numHr === null || (!isNaN(numHr) && numHr >= 30 && numHr <= 320);
  const dateValid = Boolean(date && date >= "1900-01-01" && date <= todayIso);

  const isValid = sapValid && dapValid && hrValid && dateValid;

  const currentStage = sapValid ? getBloodPressureStage(numSap) : null;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError("");

    if (!isValid || saving) return;

    setSaving(true);
    try {
      const combinedDateTime = `${date}T${time || "12:00"}:00`;
      const res = await saveVitalMeasurement({
        id: measurement?.id,
        petId,
        revision: measurement?.revision ?? 0,
        metricType: "blood_pressure",
        valuePrimary: numSap,
        valueSecondary: numDap,
        valueTertiary: numHr,
        unit: "mmHg",
        context,
        measuredAt: new Date(combinedDateTime).toISOString(),
        measuredOn: date,
        note,
      });

      if (res.error) {
        setError(
          res.isConflict
            ? pl
              ? "Wpis został zmieniony przez kogoś innego. Odśwież stronę."
              : "Entry was modified elsewhere. Please refresh."
            : pl
              ? `Błąd zapisu: ${res.error}`
              : `Save failed: ${res.error}`
        );
        return;
      }

      if (res.data) {
        onSave(res.data);
      }
    } catch {
      setError(
        pl
          ? "Nie udało się zapisać pomiaru ciśnienia. Spróbuj ponownie."
          : "Failed to save blood pressure. Please retry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="weight-dialog bp-dialog"
      ref={dialog}
      aria-labelledby="bp-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={handleSave} noValidate>
        <header>
          <span className="weight-dialog-icon">
            <IconHeartRateMonitor size={24} />
          </span>
          <div>
            <h2 id="bp-dialog-title">
              {measurement
                ? pl
                  ? "Edytuj pomiar ciśnienia"
                  : "Edit blood pressure"
                : pl
                  ? "Dodaj pomiar ciśnienia krwi"
                  : "Add blood pressure measurement"}
            </h2>
            <p>{petName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={pl ? "Zamknij okno" : "Close dialog"}
          >
            <IconX size={20} />
          </button>
        </header>

        <div className="weight-dialog-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Normy ciśnienia tętniczego wg IRIS/ACVIM dla psów i kotów: skurczowe (SAP) < 140 mmHg (norma), 140–159 mmHg (graniczne), ≥ 160 mmHg (nadciśnienie tętnicze)."
              : "Veterinary IRIS/ACVIM hypertension guidelines: systolic (SAP) < 140 mmHg is optimal; ≥ 160 mmHg indicates risk of target organ damage."}
          </p>
        </div>

        <fieldset disabled={saving}>
          {submitted && !isValid && (
            <p className="weight-error" role="alert">
              {pl
                ? "Popraw zaznaczone pola przed zapisaniem pomiaru."
                : "Correct highlighted fields before saving."}
            </p>
          )}

          <div className="bp-inputs-grid">
            <div>
              <label htmlFor="bp-sap">
                {pl ? "Ciśnienie skurczowe (SAP) *" : "Systolic (SAP) *"}
              </label>
              <div className="weight-input">
                <input
                  id="bp-sap"
                  autoFocus
                  inputMode="numeric"
                  value={sap}
                  placeholder="np. 135"
                  aria-invalid={submitted && !sapValid}
                  onChange={(e) => setSap(e.target.value)}
                />
                <span>mmHg</span>
              </div>
              {submitted && !sapValid && (
                <small className="weight-error">
                  {pl
                    ? "Wpisz wartość od 40 do 300 mmHg"
                    : "Enter a value between 40 and 300 mmHg"}
                </small>
              )}
            </div>

            <div>
              <label htmlFor="bp-dap">
                {pl ? "Rozkurczowe (DAP)" : "Diastolic (DAP)"}
              </label>
              <div className="weight-input">
                <input
                  id="bp-dap"
                  inputMode="numeric"
                  value={dap}
                  placeholder="np. 85"
                  aria-invalid={submitted && !dapValid}
                  onChange={(e) => setDap(e.target.value)}
                />
                <span>mmHg</span>
              </div>
              {submitted && !dapValid && (
                <small className="weight-error">
                  {pl
                    ? "Musi być mniejsze od skurczowego"
                    : "Must be less than systolic"}
                </small>
              )}
            </div>

            <div>
              <label htmlFor="bp-hr">
                {pl ? "Tętno (HR)" : "Heart rate (HR)"}
              </label>
              <div className="weight-input">
                <input
                  id="bp-hr"
                  inputMode="numeric"
                  value={hr}
                  placeholder="np. 120"
                  aria-invalid={submitted && !hrValid}
                  onChange={(e) => setHr(e.target.value)}
                />
                <span>bpm</span>
              </div>
              {submitted && !hrValid && (
                <small className="weight-error">
                  {pl ? "Wpisz 30–320 bpm" : "Enter 30–320 bpm"}
                </small>
              )}
            </div>
          </div>

          {currentStage && (
            <div className={`bp-stage-preview ${currentStage.colorClass}`}>
              <strong>
                {pl ? currentStage.labelPl : currentStage.labelEn}
              </strong>
              <span>
                {pl ? currentStage.riskPl : currentStage.riskEn}
              </span>
            </div>
          )}

          <div className="measure-row-2">
            <div>
              <label htmlFor="bp-date">
                {pl ? "Data pomiaru *" : "Date *"}
              </label>
              <input
                id="bp-date"
                type="date"
                min="1900-01-01"
                max={todayIso}
                value={date}
                aria-invalid={submitted && !dateValid}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bp-time">
                {pl ? "Godzina" : "Time"}
              </label>
              <input
                id="bp-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <label htmlFor="bp-context">
            {pl ? "Okoliczności / metoda pomiaru" : "Context / method"}
          </label>
          <select
            id="bp-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          >
            {CONTEXT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {pl ? opt.labelPl : opt.labelEn}
              </option>
            ))}
          </select>

          <div className="weight-note-label">
            <label htmlFor="bp-note">
              {pl ? "Notatka (opcjonalnie)" : "Note (optional)"}
            </label>
            <small>{note.length}/300</small>
          </div>
          <textarea
            id="bp-note"
            rows={2}
            maxLength={300}
            value={note}
            placeholder={
              pl
                ? "Np. średnia z 5 pomiarów, mankiet rozmiar 2, ogon, pupil spokojny"
                : "E.g. average of 5 readings, size 2 cuff on tail"
            }
            onChange={(e) => setNote(e.target.value)}
          />

          {error && (
            <p className="weight-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            {pl ? "Anuluj" : "Cancel"}
          </button>
          <button type="submit" disabled={saving}>
            <IconDeviceFloppy size={18} />
            {saving
              ? pl
                ? "Zapisywanie…"
                : "Saving…"
              : measurement
                ? pl
                  ? "Zapisz zmiany"
                  : "Save changes"
                : pl
                  ? "Zapisz pomiar"
                  : "Save measurement"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
