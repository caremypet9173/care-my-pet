"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconCalendar,
  IconCalendarRepeat,
  IconClock,
  IconDeviceFloppy,
  IconPill,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import type { Pet } from "@/features/pets/types";
import type {
  IntervalUnit,
  MedicationSchedule,
  MedicationScheduleType,
} from "./types";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

type Props = {
  pets: Pick<Pet, "id" | "imie">[];
  defaultPetId?: string;
  defaultDate?: string;
  schedule: MedicationSchedule | null;
  onClose: () => void;
  onSave: (saved: MedicationSchedule) => void;
  onDelete?: (id: string) => void;
};

export function MedicationDialog({
  pets,
  defaultPetId,
  defaultDate,
  schedule,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  const [id] = useState(() => schedule?.id ?? crypto.randomUUID());
  const [petId, setPetId] = useState(
    schedule?.pet_id ?? defaultPetId ?? pets[0]?.id ?? "",
  );
  const [name, setName] = useState(schedule?.name ?? "");
  const [dosage, setDosage] = useState(schedule?.dosage ?? "");
  const [scheduleType, setScheduleType] = useState<MedicationScheduleType>(
    schedule?.schedule_type ?? "daily",
  );
  const [startDate, setStartDate] = useState(
    schedule?.start_date ?? defaultDate ?? todayIso(),
  );
  const [hasEndDate, setHasEndDate] = useState(Boolean(schedule?.end_date));
  const [endDate, setEndDate] = useState(schedule?.end_date ?? "");
  const [scheduledTime, setScheduledTime] = useState(
    schedule?.scheduled_time ?? "08:00",
  );
  const [intervalValue, setIntervalValue] = useState<number>(
    schedule?.interval_value ?? 4,
  );
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    schedule?.interval_unit ?? "weeks",
  );
  const [instructions, setInstructions] = useState(
    schedule?.instructions ?? "",
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
      focus?.focus();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || deleting) return;

    const cleanName = name.trim();
    if (!petId) {
      setError(pl ? "Wybierz pupila." : "Select a pet.");
      return;
    }
    if (!cleanName) {
      setError(pl ? "Podaj nazwę leku lub zabiegu." : "Enter medication name.");
      return;
    }
    if (!startDate) {
      setError(pl ? "Podaj datę rozpoczęcia." : "Select start date.");
      return;
    }
    if (hasEndDate && endDate && endDate < startDate) {
      setError(
        pl
          ? "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia."
          : "End date cannot be earlier than start date.",
      );
      return;
    }
    if (scheduleType === "interval" && (!intervalValue || intervalValue < 1)) {
      setError(
        pl
          ? "Podaj poprawny interwał (minimum 1)."
          : "Enter a valid interval (minimum 1).",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      id,
      pet_id: petId,
      revision: schedule?.revision ?? 0,
      item: {
        name: cleanName,
        dosage: dosage.trim(),
        schedule_type: scheduleType,
        interval_value: scheduleType === "interval" ? intervalValue : null,
        interval_unit: scheduleType === "interval" ? intervalUnit : null,
        start_date: startDate,
        end_date: hasEndDate && endDate ? endDate : null,
        scheduled_time: scheduledTime.trim(),
        instructions: instructions.trim(),
        is_active: true,
      },
    };

    try {
      const client = createClient();
      // Najpierw próbujemy przez Edge Function `pet-medications`
      let savedSchedule: MedicationSchedule | null = null;
      try {
        const { data: fnData, error: fnError } = await client.functions.invoke(
          "pet-medications",
          { body: payload },
        );
        if (!fnError && fnData?.schedule) {
          savedSchedule = fnData.schedule as MedicationSchedule;
        }
      } catch {
        // Fallback do bezpośredniego RPC jeśli Edge function nie jest dostępna lokalnie
      }

      if (!savedSchedule) {
        const { data: rpcData, error: rpcError } = await client.rpc(
          "save_medication_schedule",
          {
            p_id: payload.id,
            p_pet_id: payload.pet_id,
            p_revision: payload.revision,
            p_name: payload.item.name,
            p_dosage: payload.item.dosage,
            p_schedule_type: payload.item.schedule_type,
            p_interval_value: payload.item.interval_value,
            p_interval_unit: payload.item.interval_unit,
            p_start_date: payload.item.start_date,
            p_end_date: payload.item.end_date,
            p_scheduled_time: payload.item.scheduled_time,
            p_instructions: payload.item.instructions,
            p_is_active: payload.item.is_active,
          },
        );

        if (rpcError) {
          setError(
            rpcError.code === "PT409"
              ? pl
                ? "Wpis został zmodyfikowany przez kogoś innego. Odśwież stronę."
                : "Entry was modified elsewhere. Please refresh."
              : pl
                ? "Nie udało się zapisać harmonogramu leku. Spróbuj ponownie."
                : "Failed to save medication schedule. Please retry.",
          );
          return;
        }
        savedSchedule = rpcData as MedicationSchedule;
      }

      if (savedSchedule) {
        onSave(savedSchedule);
      }
    } catch {
      setError(
        pl
          ? "Wystąpił błąd połączenia. Spróbuj ponownie."
          : "Connection error. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!schedule || !onDelete || deleting || saving) return;
    const confirmMsg = pl
      ? `Czy na pewno chcesz usunąć harmonogram leku „${schedule.name}”?`
      : `Are you sure you want to delete schedule for "${schedule.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    setError("");

    try {
      const client = createClient();
      let deleted = false;
      try {
        const { data: fnData, error: fnError } = await client.functions.invoke(
          "pet-medications",
          {
            body: {
              action: "delete",
              id: schedule.id,
              pet_id: schedule.pet_id,
              revision: schedule.revision,
            },
          },
        );
        if (!fnError && fnData?.deleted) deleted = true;
      } catch {
        // Fallback do RPC
      }

      if (!deleted) {
        const { error: rpcError } = await client.rpc(
          "delete_medication_schedule",
          {
            p_id: schedule.id,
            p_pet_id: schedule.pet_id,
            p_revision: schedule.revision,
          },
        );
        if (rpcError) {
          setError(
            pl
              ? "Nie udało się usunąć harmonogramu."
              : "Failed to delete schedule.",
          );
          return;
        }
      }

      onDelete(schedule.id);
    } catch {
      setError(
        pl
          ? "Wystąpił problem z połączeniem."
          : "Connection problem occurred.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="weight-dialog history-dialog"
      aria-labelledby="medication-dialog-title"
      onCancel={(e) => {
        if (saving || deleting) e.preventDefault();
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current && !saving && !deleting) onClose();
      }}
    >
      <form onSubmit={submit} noValidate>
        <header>
          <span
            className="weight-dialog-icon history-dialog-icon is-prevention"
            aria-hidden="true"
          >
            <IconPill size={24} />
          </span>
          <div>
            <h2 id="medication-dialog-title">
              {schedule
                ? pl
                  ? "Edytuj lek lub zabieg"
                  : "Edit medication"
                : pl
                  ? "Zaplanuj lek lub zabieg"
                  : "Schedule medication"}
            </h2>
            <p>
              {pl
                ? "Skonfiguruj dawkowanie doraźne, codzienne lub interwałowe"
                : "Configure one-off, daily, or interval dosage schedule"}
            </p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            disabled={saving || deleting}
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset disabled={saving || deleting}>
          <div className="history-dialog-grid">
            {/* Wybór zwierzaka */}
            {pets.length > 1 && !defaultPetId ? (
              <div className="full-width">
                <label htmlFor="med-pet-select">
                  {pl ? "Pupil *" : "Pet *"}
                </label>
                <select
                  id="med-pet-select"
                  value={petId}
                  onChange={(e) => setPetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900"
                >
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.imie}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Nazwa leku i dawka */}
            <div>
              <label htmlFor="med-name">
                {pl ? "Nazwa leku / zabiegu *" : "Medication / treatment *"}
              </label>
              <input
                id="med-name"
                value={name}
                maxLength={120}
                required
                placeholder={
                  pl
                    ? "np. Flora Balance, Melovem, Wlew z ketaminy"
                    : "e.g. Flora Balance, Melovem, Ketamine infusion"
                }
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="med-dosage">
                {pl ? "Dawka i postać" : "Dosage & form"}
              </label>
              <input
                id="med-dosage"
                value={dosage}
                maxLength={120}
                placeholder={
                  pl
                    ? "np. 1 kapsułka, 2.5 ml, 1 tabletka"
                    : "e.g. 1 capsule, 2.5 ml, 1 tablet"
                }
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>

            {/* Wybór scenariusza podawania leku */}
            <div className="full-width">
              <label className="block mb-2 font-medium">
                {pl ? "Wariant dawkowania *" : "Dosage schedule variant *"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType("one_off")}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    scheduleType === "one_off"
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-2 ring-teal-600/30 font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-sm">
                    <IconClock size={16} />
                    <span>{pl ? "Jednorazowe" : "One-off"}</span>
                  </div>
                  <span className="text-xs font-normal opacity-80">
                    {pl ? "Doraźny lek, szybki zapis" : "Single dose as needed"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType("daily")}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    scheduleType === "daily"
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-2 ring-teal-600/30 font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-sm">
                    <IconCalendar size={16} />
                    <span>{pl ? "Stałe, codzienne" : "Daily routine"}</span>
                  </div>
                  <span className="text-xs font-normal opacity-80">
                    {pl ? "Rutynowe codzienne podania" : "Regular daily intake"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType("interval")}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    scheduleType === "interval"
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-2 ring-teal-600/30 font-semibold"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-sm">
                    <IconCalendarRepeat size={16} />
                    <span>{pl ? "Cykliczne" : "Interval"}</span>
                  </div>
                  <span className="text-xs font-normal opacity-80">
                    {pl ? "Powtarzane co X dni / tyg." : "Every X days / weeks"}
                  </span>
                </button>
              </div>
            </div>

            {/* Pola specyficzne dla wybranego wariantu */}
            {scheduleType === "one_off" && (
              <>
                <div>
                  <label htmlFor="med-oneoff-date">
                    {pl ? "Data podania *" : "Date *"}
                  </label>
                  <input
                    id="med-oneoff-date"
                    type="date"
                    value={startDate}
                    required
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="med-oneoff-time">
                    {pl ? "Godzina podania" : "Time"}
                  </label>
                  <input
                    id="med-oneoff-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </>
            )}

            {scheduleType === "daily" && (
              <>
                <div>
                  <label htmlFor="med-daily-time">
                    {pl ? "Godzina podania *" : "Time *"}
                  </label>
                  <input
                    id="med-daily-time"
                    type="time"
                    value={scheduledTime}
                    required
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="med-daily-start">
                    {pl ? "Data rozpoczęcia *" : "Start date *"}
                  </label>
                  <input
                    id="med-daily-start"
                    type="date"
                    value={startDate}
                    required
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="full-width">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="med-has-end-date"
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                    />
                    <label
                      htmlFor="med-has-end-date"
                      className="m-0 text-sm font-normal cursor-pointer select-none"
                    >
                      {pl
                        ? "Kuracja czasowa (określona data zakończenia)"
                        : "Fixed-term treatment (has end date)"}
                    </label>
                  </div>
                  {hasEndDate && (
                    <div className="max-w-xs">
                      <label htmlFor="med-daily-end">
                        {pl ? "Data zakończenia" : "End date"}
                      </label>
                      <input
                        id="med-daily-end"
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {scheduleType === "interval" && (
              <>
                <div className="full-width">
                  <label>
                    {pl ? "Częstotliwość powtórzeń *" : "Repeat interval *"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {pl ? "Co" : "Every"}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={intervalValue}
                      onChange={(e) =>
                        setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-24 text-center font-semibold"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) =>
                        setIntervalUnit(e.target.value as IntervalUnit)
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900"
                    >
                      <option value="days">
                        {intervalValue === 1
                          ? pl
                            ? "dzień"
                            : "day"
                          : pl
                            ? "dni"
                            : "days"}
                      </option>
                      <option value="weeks">
                        {intervalValue === 1
                          ? pl
                            ? "tydzień"
                            : "week"
                          : pl
                            ? "tygodnie/tygodni"
                            : "weeks"}
                      </option>
                      <option value="months">
                        {intervalValue === 1
                          ? pl
                            ? "miesiąc"
                            : "month"
                          : pl
                            ? "miesięcy"
                            : "months"}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="med-interval-start">
                    {pl ? "Pierwsze podanie od *" : "First dose date *"}
                  </label>
                  <input
                    id="med-interval-start"
                    type="date"
                    value={startDate}
                    required
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="med-interval-time">
                    {pl ? "Godzina podania" : "Time"}
                  </label>
                  <input
                    id="med-interval-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>

                <div className="full-width">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="med-interval-has-end"
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                    />
                    <label
                      htmlFor="med-interval-has-end"
                      className="m-0 text-sm font-normal cursor-pointer select-none"
                    >
                      {pl
                        ? "Zakończ cykl po określonej dacie"
                        : "End cycle after specific date"}
                    </label>
                  </div>
                  {hasEndDate && (
                    <div className="max-w-xs">
                      <label htmlFor="med-interval-end">
                        {pl ? "Data zakończenia cyklu" : "Cycle end date"}
                      </label>
                      <input
                        id="med-interval-end"
                        type="date"
                        min={startDate}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Wskazówki i notatki */}
            <div className="full-width">
              <label htmlFor="med-instructions">
                {pl
                  ? "Wskazówki dla opiekuna (opcjonalnie)"
                  : "Instructions & notes (optional)"}
              </label>
              <textarea
                id="med-instructions"
                rows={2}
                maxLength={2000}
                placeholder={
                  pl
                    ? "np. Podawać z mokrą karmą, nie podawać na czczo, wymieszać z sosem"
                    : "e.g. Give with food, do not administer on empty stomach"
                }
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="weight-error mt-3">{error}</p>}
        </fieldset>

        <footer className="flex items-center justify-between gap-3">
          {schedule && onDelete ? (
            <button
              type="button"
              className="text-red-700 hover:text-red-800 text-sm flex items-center gap-1.5 p-2"
              disabled={saving || deleting}
              onClick={handleDelete}
            >
              <IconTrash size={16} />
              <span>{deleting ? (pl ? "Usuwanie..." : "Deleting...") : pl ? "Usuń harmonogram" : "Delete"}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || deleting}
              onClick={onClose}
            >
              {pl ? "Anuluj" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="bg-teal-800 text-white flex items-center gap-1.5 font-medium"
            >
              <IconDeviceFloppy size={16} />
              <span>
                {saving
                  ? pl
                    ? "Zapisywanie..."
                    : "Saving..."
                  : pl
                    ? "Zapisz lek"
                    : "Save medication"}
              </span>
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
