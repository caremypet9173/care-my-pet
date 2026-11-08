"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconTemperature,
  IconX,
  IconInfoCircle,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { saveVitalMeasurement } from "./actions";
import { getTemperatureStatus, type VitalMeasurement } from "./types";

const CONTEXT_OPTIONS = [
  { value: "rectal", labelPl: "Pomiar rektalny (standard weterynaryjny)", labelEn: "Rectal (standard)" },
  { value: "ear", labelPl: "Termometr douszny weterynaryjny", labelEn: "Ear thermometer" },
  { value: "axillary", labelPl: "W pachwinie / pod pachą (orientacyjny)", labelEn: "Axillary / groin" },
  { value: "resting", labelPl: "W pełnym spoczynku", labelEn: "At rest" },
  { value: "after_effort", labelPl: "Po intensywnym wysiłku / zabawie", labelEn: "After exercise" },
  { value: "clinic", labelPl: "W gabinecie weterynaryjnym", labelEn: "At clinic" },
];

export function TemperatureDialog({
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

  const [tempStr, setTempStr] = useState(() => {
    if (!measurement) return "";
    return String(measurement.value_primary).replace(".", pl ? "," : ".");
  });

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

  const [context, setContext] = useState(measurement?.context ?? "rectal");
  const [note, setNote] = useState(measurement?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const numTemp = Number(tempStr.replace(",", "."));
  const isValidTemp = !isNaN(numTemp) && numTemp >= 32.0 && numTemp <= 44.0;
  const dateValid = Boolean(date && date >= "1900-01-01" && date <= todayIso);
  const isValid = isValidTemp && dateValid;

  const status = isValidTemp ? getTemperatureStatus(numTemp) : null;

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
        metricType: "temperature",
        valuePrimary: Math.round(numTemp * 10) / 10,
        unit: "°C",
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
          ? "Nie udało się zapisać temperatury. Spróbuj ponownie."
          : "Failed to save temperature. Please retry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="weight-dialog temp-dialog"
      ref={dialog}
      aria-labelledby="temp-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={handleSave} noValidate>
        <header>
          <span className="weight-dialog-icon">
            <IconTemperature size={24} />
          </span>
          <div>
            <h2 id="temp-dialog-title">
              {measurement
                ? pl
                  ? "Edytuj pomiar temperatury"
                  : "Edit temperature"
                : pl
                  ? "Dodaj pomiar temperatury ciała"
                  : "Add body temperature"}
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
              ? "Prawidłowa temperatura ciała u psów i kotów wynosi 37.5–39.0°C (u młodych szczeniąt do 39.2°C). Wartość ≥ 39.5°C to gorączka."
              : "Normal body temperature for dogs and cats is 37.5–39.0°C. Temperature ≥ 39.5°C indicates fever."}
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

          <label htmlFor="temp-val">
            {pl ? "Temperatura ciała *" : "Body temperature *"}
          </label>
          <div className="weight-input">
            <input
              id="temp-val"
              autoFocus
              inputMode="decimal"
              value={tempStr}
              placeholder="np. 38,5"
              aria-invalid={submitted && !isValidTemp}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{0,2}([.,]\d{0,1})?$/.test(val)) {
                  setTempStr(val);
                }
              }}
            />
            <span>°C</span>
          </div>

          {submitted && !isValidTemp && (
            <small className="weight-error">
              {pl
                ? "Wpisz poprawną temperaturę (32.0–44.0 °C z 1 miejscem po przecinku)"
                : "Enter a valid temperature (32.0–44.0 °C with 1 decimal)"}
            </small>
          )}

          {status && (
            <div className={`bp-stage-preview ${status.colorClass}`}>
              <strong>{pl ? status.labelPl : status.labelEn}</strong>
              <span>{pl ? status.descPl : status.descEn}</span>
            </div>
          )}

          <div className="measure-row-2">
            <div>
              <label htmlFor="temp-date">
                {pl ? "Data pomiaru *" : "Date *"}
              </label>
              <input
                id="temp-date"
                type="date"
                min="1900-01-01"
                max={todayIso}
                value={date}
                aria-invalid={submitted && !dateValid}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="temp-time">
                {pl ? "Godzina" : "Time"}
              </label>
              <input
                id="temp-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <label htmlFor="temp-context">
            {pl ? "Miejsce / metoda pomiaru" : "Measurement method / location"}
          </label>
          <select
            id="temp-context"
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
            <label htmlFor="temp-note">
              {pl ? "Notatka (opcjonalnie)" : "Note (optional)"}
            </label>
            <small>{note.length}/300</small>
          </div>
          <textarea
            id="temp-note"
            rows={2}
            maxLength={300}
            value={note}
            placeholder={
              pl
                ? "Np. termometr cyfrowy elastyczny, pomiar z żelem, pupil spokojny"
                : "E.g. digital flexible tip thermometer with lubricant"
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
