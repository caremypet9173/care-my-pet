"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconDroplet,
  IconX,
  IconInfoCircle,
  IconDeviceFloppy,
  IconArrowsExchange,
} from "@tabler/icons-react";
import { saveVitalMeasurement } from "./actions";
import { getGlucoseStatus, type VitalMeasurement } from "./types";

const CONTEXT_OPTIONS = [
  { value: "fasting", labelPl: "Na czczo", labelEn: "Fasting" },
  { value: "postprandial", labelPl: "Po posiłku", labelEn: "Postprandial" },
  { value: "random", labelPl: "Losowy pomiar w ciągu dnia", labelEn: "Random check" },
  { value: "pre_insulin", labelPl: "Przed podaniem insuliny", labelEn: "Before insulin" },
  { value: "post_insulin", labelPl: "Po podaniu insuliny", labelEn: "After insulin" },
  { value: "clinic", labelPl: "W gabinecie weterynaryjnym", labelEn: "At vet clinic" },
];

export function GlucoseDialog({
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

  const [inputUnit, setInputUnit] = useState<"mg/dL" | "mmol/L">("mg/dL");
  const [valueStr, setValueStr] = useState(() => {
    if (!measurement) return "";
    return String(measurement.value_primary);
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

  const [context, setContext] = useState(measurement?.context ?? "fasting");
  const [note, setNote] = useState(measurement?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const rawNum = Number(valueStr.replace(",", "."));
  const mgDlValue = inputUnit === "mg/dL" ? rawNum : rawNum * 18.0182;
  const mmolLValue = inputUnit === "mmol/L" ? rawNum : rawNum / 18.0182;

  const isValidValue = !isNaN(mgDlValue) && mgDlValue >= 10 && mgDlValue <= 800;
  const dateValid = Boolean(date && date >= "1900-01-01" && date <= todayIso);
  const isValid = isValidValue && dateValid;

  const status = isValidValue ? getGlucoseStatus(mgDlValue) : null;

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

  function toggleUnit() {
    if (!isValidValue) {
      setInputUnit((u) => (u === "mg/dL" ? "mmol/L" : "mg/dL"));
      return;
    }
    if (inputUnit === "mg/dL") {
      setInputUnit("mmol/L");
      setValueStr((rawNum / 18.0182).toFixed(1).replace(".", pl ? "," : "."));
    } else {
      setInputUnit("mg/dL");
      setValueStr(Math.round(rawNum * 18.0182).toString());
    }
  }

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
        metricType: "glucose",
        valuePrimary: Math.round(mgDlValue * 10) / 10,
        unit: "mg/dL",
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
          ? "Nie udało się zapisać pomiaru glukozy. Spróbuj ponownie."
          : "Failed to save blood glucose. Please retry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      className="weight-dialog glucose-dialog"
      ref={dialog}
      aria-labelledby="glucose-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={handleSave} noValidate>
        <header>
          <span className="weight-dialog-icon">
            <IconDroplet size={24} />
          </span>
          <div>
            <h2 id="glucose-dialog-title">
              {measurement
                ? pl
                  ? "Edytuj pomiar glukozy"
                  : "Edit glucose measurement"
                : pl
                  ? "Dodaj pomiar glukozy (glikemii)"
                  : "Add blood glucose measurement"}
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
              ? "Prawidłowy poziom glukozy u psów i kotów na czczo wynosi 70–150 mg/dL (3.9–8.3 mmol/L). Wartości poniżej 70 mg/dL oznaczają hipoglikemię."
              : "Normal blood glucose in dogs and cats: 70–150 mg/dL (3.9–8.3 mmol/L). Values below 70 mg/dL indicate hypoglycemia."}
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

          <div className="glucose-input-unit-bar">
            <label htmlFor="glucose-val">
              {pl ? "Stężenie glukozy *" : "Blood glucose *"}
            </label>
            <button
              type="button"
              className="unit-switch-btn"
              onClick={toggleUnit}
              title={pl ? "Zmień jednostkę wprowadzania" : "Switch input unit"}
            >
              <IconArrowsExchange size={14} />
              <span>{inputUnit}</span>
            </button>
          </div>

          <div className="weight-input">
            <input
              id="glucose-val"
              autoFocus
              inputMode="decimal"
              value={valueStr}
              placeholder={inputUnit === "mg/dL" ? "np. 95" : "np. 5.3"}
              aria-invalid={submitted && !isValidValue}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{0,4}([.,]\d{0,2})?$/.test(val)) {
                  setValueStr(val);
                }
              }}
            />
            <span>{inputUnit}</span>
          </div>

          {isValidValue && (
            <div className="glucose-conv-hint">
              {inputUnit === "mg/dL"
                ? `≈ ${mmolLValue.toFixed(1)} mmol/L`
                : `≈ ${Math.round(mgDlValue)} mg/dL`}
            </div>
          )}

          {submitted && !isValidValue && (
            <small className="weight-error">
              {pl
                ? "Wpisz poprawną wartość (10–800 mg/dL)"
                : "Enter a valid value (10–800 mg/dL)"}
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
              <label htmlFor="glucose-date">
                {pl ? "Data pomiaru *" : "Date *"}
              </label>
              <input
                id="glucose-date"
                type="date"
                min="1900-01-01"
                max={todayIso}
                value={date}
                aria-invalid={submitted && !dateValid}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="glucose-time">
                {pl ? "Godzina" : "Time"}
              </label>
              <input
                id="glucose-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <label htmlFor="glucose-context">
            {pl ? "Okoliczności pomiaru" : "Measurement context"}
          </label>
          <select
            id="glucose-context"
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
            <label htmlFor="glucose-note">
              {pl ? "Notatka (opcjonalnie)" : "Note (optional)"}
            </label>
            <small>{note.length}/300</small>
          </div>
          <textarea
            id="glucose-note"
            rows={2}
            maxLength={300}
            value={note}
            placeholder={
              pl
                ? "Np. pomiar glukometrem AlphaTrak z ucha, 2h po podaniu 2 jednostek insuliny Caninsulin"
                : "E.g. tested with pet glucometer from ear, 2h post insulin"
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
