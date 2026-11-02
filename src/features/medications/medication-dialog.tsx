"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconCalendar,
  IconCalendarRepeat,
  IconClock,
  IconDeviceFloppy,
  IconPackage,
  IconPill,
  IconPlus,
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
  const [endDate, setEndDate] = useState(schedule?.end_date ?? "");
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(() => {
    if (schedule?.scheduled_times && schedule.scheduled_times.length > 0) {
      return schedule.scheduled_times;
    }
    if (schedule?.scheduled_time) {
      return [schedule.scheduled_time];
    }
    return ["08:00"];
  });
  const [intervalValue, setIntervalValue] = useState<number>(
    schedule?.interval_value ?? 4,
  );
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    schedule?.interval_unit ?? "weeks",
  );
  const [instructions, setInstructions] = useState(
    schedule?.instructions ?? "",
  );
  const [trackStock, setTrackStock] = useState<boolean>(
    schedule?.stock_quantity != null,
  );
  const [stockQuantity, setStockQuantity] = useState<string>(
    schedule?.stock_quantity != null ? String(schedule.stock_quantity) : "",
  );
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(
    schedule?.low_stock_threshold != null
      ? String(schedule.low_stock_threshold)
      : "5",
  );
  const [stockUnit, setStockUnit] = useState<string>(
    schedule?.stock_unit || (pl ? "tabletek" : "tablets"),
  );

  function addTimeSlot() {
    setScheduledTimes((prev) => {
      const last = prev[prev.length - 1] || "08:00";
      const [h = 8, m = 0] = last.split(":").map(Number);
      const nextH = (h + 8) % 24;
      const nextTime = `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      return [...prev, nextTime];
    });
  }

  function updateTimeSlot(index: number, val: string) {
    setScheduledTimes((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function removeTimeSlot(index: number) {
    setScheduledTimes((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

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
    if (endDate && endDate < startDate) {
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

    const hhMm = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    const validTimes = Array.from(
      new Set(scheduledTimes.filter((t) => hhMm.test(t.trim()))),
    ).sort();
    if (validTimes.length === 0) {
      setError(
        pl
          ? "Podaj przynajmniej jedną poprawną godzinę podania (np. 08:00)."
          : "Enter at least one valid time (e.g. 08:00).",
      );
      return;
    }
    const cleanTime = validTimes[0] ?? "";

    setSaving(true);
    setError("");

    const cleanEndDate =
      scheduleType === "one_off" ? null : endDate.trim() ? endDate.trim() : null;

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
        end_date: cleanEndDate,
        scheduled_time: cleanTime,
        scheduled_times: validTimes,
        instructions: instructions.trim(),
        is_active: true,
        stock_quantity:
          trackStock && stockQuantity !== ""
            ? Math.max(0, Number(stockQuantity))
            : null,
        low_stock_threshold:
          trackStock && lowStockThreshold !== ""
            ? Math.max(0, Number(lowStockThreshold))
            : 5,
        stock_unit: trackStock && stockUnit.trim() ? stockUnit.trim() : pl ? "dawek" : "doses",
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
        let rpcData: unknown = null;
        let rpcError: { code?: string; message?: string } | null = null;

        const res = await client.rpc("save_medication_schedule", {
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
          p_scheduled_times: payload.item.scheduled_times,
          p_stock_quantity: payload.item.stock_quantity,
          p_low_stock_threshold: payload.item.low_stock_threshold,
          p_stock_unit: payload.item.stock_unit,
        });

        if (res.error && (res.error.message?.includes("parameter") || res.error.message?.includes("function"))) {
          const resFallback = await client.rpc("save_medication_schedule", {
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
            p_scheduled_times: payload.item.scheduled_times,
          });
          rpcData = resFallback.data;
          rpcError = resFallback.error;
        } else {
          rpcData = res.data;
          rpcError = res.error;
        }

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

        <fieldset disabled={saving || deleting} className="flex flex-col gap-4">
          {/* Wybór zwierzaka */}
          {pets.length > 1 && !defaultPetId ? (
            <div>
              <label htmlFor="med-pet-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {pl ? "Pupil *" : "Pet *"}
              </label>
              <select
                id="med-pet-select"
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900 text-sm"
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.imie}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Nazwa leku i dawka w 2 kolumnach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="med-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {pl ? "Nazwa leku / zabiegu *" : "Medication / treatment *"}
              </label>
              <input
                id="med-name"
                value={name}
                maxLength={120}
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900 text-sm"
                placeholder={
                  pl
                    ? "np. Flora Balance, Melovem, Wlew z ketaminy"
                    : "e.g. Flora Balance, Melovem, Ketamine infusion"
                }
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="med-dosage" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {pl ? "Dawka i postać" : "Dosage & form"}
              </label>
              <input
                id="med-dosage"
                value={dosage}
                maxLength={120}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900 text-sm"
                placeholder={
                  pl
                    ? "np. 1 kapsułka, 2.5 ml, 1 tabletka"
                    : "e.g. 1 capsule, 2.5 ml, 1 tablet"
                }
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
          </div>

          {/* Wybór scenariusza podawania leku */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {pl ? "Wariant dawkowania *" : "Dosage schedule variant *"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setScheduleType("one_off")}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scheduleType === "one_off"
                    ? "border-teal-700 bg-teal-50/90 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 shadow-xs ring-1 ring-teal-700/50"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      scheduleType === "one_off"
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <IconClock size={16} />
                  </span>
                  <span className="font-semibold text-sm leading-tight">
                    {pl ? "Jednorazowe" : "One-off"}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  {pl ? "Doraźny lek, szybki zapis dawki" : "Single dose as needed"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleType("daily")}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scheduleType === "daily"
                    ? "border-teal-700 bg-teal-50/90 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 shadow-xs ring-1 ring-teal-700/50"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      scheduleType === "daily"
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <IconCalendar size={16} />
                  </span>
                  <span className="font-semibold text-sm leading-tight">
                    {pl ? "Stałe, codzienne" : "Daily routine"}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  {pl ? "Rutynowe codzienne podawanie" : "Regular daily intake"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleType("interval")}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scheduleType === "interval"
                    ? "border-teal-700 bg-teal-50/90 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 shadow-xs ring-1 ring-teal-700/50"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      scheduleType === "interval"
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <IconCalendarRepeat size={16} />
                  </span>
                  <span className="font-semibold text-sm leading-tight">
                    {pl ? "Cykliczne" : "Interval"}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  {pl ? "Powtarzane co X dni / tyg." : "Every X days / weeks"}
                </span>
              </button>
            </div>
          </div>

          {/* Harmonogram dat zależny od wariantu */}
          {scheduleType === "one_off" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-oneoff-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {pl ? "Data podania *" : "Date *"}
                </label>
                <input
                  id="med-oneoff-date"
                  type="date"
                  value={startDate}
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {scheduleType === "daily" && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="med-daily-start" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {pl ? "Data rozpoczęcia *" : "Start date *"}
                  </label>
                  <input
                    id="med-daily-start"
                    type="date"
                    value={startDate}
                    required
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="med-daily-end" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {pl ? "Data zakończenia" : "End date"}{" "}
                    <span className="font-normal text-slate-400">
                      {pl ? "(opcjonalnie)" : "(optional)"}
                    </span>
                  </label>
                  <input
                    id="med-daily-end"
                    type="date"
                    min={startDate}
                    value={endDate}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {pl
                  ? "Pozostaw datę zakończenia pustą, jeśli lek jest podawany na stałe (bezterminowo)."
                  : "Leave end date empty if medication is administered indefinitely."}
              </p>
            </div>
          )}

          {scheduleType === "interval" && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {pl ? "Częstotliwość powtórzeń *" : "Repeat interval *"}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">
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
                      className="w-20 text-center font-semibold rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) =>
                        setIntervalUnit(e.target.value as IntervalUnit)
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm flex-1"
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
                  <label htmlFor="med-interval-start" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {pl ? "Pierwsze podanie od *" : "First dose date *"}
                  </label>
                  <input
                    id="med-interval-start"
                    type="date"
                    value={startDate}
                    required
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start pt-1">
                <div>
                  <label htmlFor="med-interval-end" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {pl ? "Data zakończenia cyklu" : "Cycle end date"}{" "}
                    <span className="font-normal text-slate-400">
                      {pl ? "(opcjonalnie)" : "(optional)"}
                    </span>
                  </label>
                  <input
                    id="med-interval-end"
                    type="date"
                    min={startDate}
                    value={endDate}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2 bg-white dark:bg-slate-900 text-sm"
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {pl
                  ? "Pozostaw datę zakończenia pustą, jeśli cykl ma trwać bezterminowo."
                  : "Leave end date empty if cycle runs indefinitely."}
              </p>
            </div>
          )}

          {/* Pory podawania w ciągu wyznaczonego dnia */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/80 dark:bg-slate-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">
                  {pl ? "Pory podawania w ciągu dnia *" : "Daily administration times *"}
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pl
                    ? "Możesz dodać kilka dawek dziennie (np. rano i wieczorem)"
                    : "You can schedule multiple doses per day (e.g. morning and evening)"}
                </p>
              </div>

              {/* Presety */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-0.5 hidden md:inline">
                  {pl ? "Szybki wybór:" : "Presets:"}
                </span>
                <button
                  type="button"
                  onClick={() => setScheduledTimes(["08:00"])}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-700 hover:text-teal-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                >
                  1× (08:00)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduledTimes(["08:00", "20:00"])}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-700 hover:text-teal-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                >
                  2× (08:00, 20:00)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduledTimes(["08:00", "14:00", "20:00"])}
                  className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-700 hover:text-teal-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
                >
                  3× (08:00, 14:00, 20:00)
                </button>
              </div>
            </div>

            {/* Lista slotów czasowych */}
            <div className="flex flex-wrap gap-2 items-center">
              {scheduledTimes.map((time, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20 transition-all"
                >
                  <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    {pl ? `Dawka #${idx + 1}:` : `Dose #${idx + 1}:`}
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTimeSlot(idx, e.target.value)}
                    className="med-time-input border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0 cursor-pointer w-20"
                    required
                  />
                  {scheduledTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded cursor-pointer"
                      title={pl ? "Usuń tę porę" : "Remove dose time"}
                      aria-label={pl ? "Usuń tę porę" : "Remove dose time"}
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addTimeSlot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-teal-700/50 hover:border-teal-700 bg-teal-50/50 hover:bg-teal-50 dark:bg-teal-950/20 dark:hover:bg-teal-950/40 text-xs font-semibold text-teal-800 dark:text-teal-300 transition-colors cursor-pointer"
              >
                <IconPlus size={14} />
                <span>{pl ? "+ Dodaj kolejną porę" : "+ Add another time"}</span>
              </button>
            </div>
          </div>

          {/* Kontrola zapasu w apteczce */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-700 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <IconPackage size={15} className="text-teal-700 dark:text-teal-400" />
                  {pl ? "Kontrola zapasu w apteczce" : "Track medication stock"}
                </span>
              </label>
              <span className="text-[11px] text-slate-400">
                {pl ? "Automatycznie odlicza podane dawki" : "Decrements when dose is taken"}
              </span>
            </div>

            {trackStock && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {pl ? "Pozostały zapas:" : "Current stock:"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="np. 30"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {pl ? "Jednostka zapasu:" : "Unit:"}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder={pl ? "np. tabletek, ml" : "e.g. tablets, ml"}
                    value={stockUnit}
                    onChange={(e) => setStockUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {pl ? "Ostrzegaj, gdy poniżej:" : "Low stock alert below:"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="np. 5"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 bg-white dark:bg-slate-900 text-sm font-semibold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Wskazówki i notatki */}
          <div>
            <label htmlFor="med-instructions" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {pl
                ? "Wskazówki dla opiekuna (opcjonalnie)"
                : "Instructions & notes (optional)"}
            </label>
            <textarea
              id="med-instructions"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-900 text-sm"
              placeholder={
                pl
                  ? "np. Podawać z mokrą karmą, nie podawać na czczo, wymieszać z sosem"
                  : "e.g. Give with food, do not administer on empty stomach"
              }
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {error && <p className="weight-error mt-1">{error}</p>}
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
