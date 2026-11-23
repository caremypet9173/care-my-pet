"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconDroplet,
  IconEdit,
  IconNotes,
  IconPill,
  IconPlus,
  IconPrinter,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const MedicationDialog = dynamic(
  () => import("./medication-dialog").then((m) => m.MedicationDialog),
  { ssr: false },
);
const SkipDoseDialog = dynamic(
  () => import("./skip-dose-dialog").then((m) => m.SkipDoseDialog),
  { ssr: false },
);
const TreatmentSummaryModal = dynamic(
  () => import("./treatment-summary-modal").then((m) => m.TreatmentSummaryModal),
  { ssr: false },
);
import {
  parseScheduledTimes,
  projectMedicationDoses,
} from "./projection";
import { useMedicationRealtime } from "./use-medication-realtime";
import type {
  MedicationLog,
  MedicationSchedule,
  ProjectedMedicationDose,
} from "./types";

function createTempLogId(): string {
  return `temp-${Date.now()}`;
}

interface Props {
  petId: string;
  petName: string;
  initialSchedules: MedicationSchedule[];
  initialLogs?: MedicationLog[];
  memberNames?: Record<string, string>;
  currentUserId?: string;
  pets: { id: string; imie: string }[];
  petData?: {
    id: string;
    imie: string;
    gatunek: string;
    rasa?: string | null;
    data_urodzenia?: string | null;
    data_urodzenia_przyblizona?: boolean | null;
    plec: string;
    kastracja?: boolean | null;
    identyfikacja?: string;
    numer_id?: string | null;
    notatki?: string | null;
    tagi?: string[];
  };
  weight?: { kg: number; measured_on: string } | null;
  reports?: Array<{
    id: string;
    title: string;
    test_date: string;
    laboratory?: string | null;
  }>;
  keyParameters?: Array<{
    row: { name: string; value: string; unit: string; note?: string };
    date: string;
  }>;
  readOnly?: boolean;
}

export function ActiveMedicationsCard({
  petId,
  petName,
  initialSchedules,
  initialLogs = [],
  memberNames = {},
  currentUserId,
  pets,
  petData,
  weight = null,
  reports = [],
  keyParameters = [],
  readOnly = false,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const pl = locale === "pl";

  const [prevInitialSchedules, setPrevInitialSchedules] =
    useState<MedicationSchedule[]>(initialSchedules);
  const [schedules, setSchedules] =
    useState<MedicationSchedule[]>(initialSchedules);
  if (initialSchedules !== prevInitialSchedules) {
    setPrevInitialSchedules(initialSchedules);
    setSchedules(initialSchedules);
  }

  const [prevInitialLogs, setPrevInitialLogs] =
    useState<MedicationLog[]>(initialLogs);
  const [logs, setLogs] = useState<MedicationLog[]>(initialLogs);
  if (initialLogs !== prevInitialLogs) {
    setPrevInitialLogs(initialLogs);
    setLogs(initialLogs);
  }
  const [filterMode, setFilterMode] = useState<"active" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<MedicationSchedule | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [skippingDose, setSkippingDose] =
    useState<ProjectedMedicationDose | null>(null);
  const [busyDoseKey, setBusyDoseKey] = useState<string | null>(null);

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const activeSchedules = schedules.filter(
    (s) => s.is_active && (!s.end_date || s.end_date >= todayIso),
  );

  const displayedSchedules =
    filterMode === "active" ? activeSchedules : schedules;

  function formatScheduleType(s: MedicationSchedule) {
    if (s.schedule_type === "one_off") {
      return pl ? "Doraźne / jednorazowe" : "One-off / as needed";
    }
    if (s.schedule_type === "daily") {
      if (s.end_date) {
        return pl
          ? `Kuracja czasowa (do ${s.end_date})`
          : `Time-limited (until ${s.end_date})`;
      }
      return pl ? "Stałe, codzienne" : "Daily ongoing";
    }
    if (s.schedule_type === "interval") {
      const val = s.interval_value || 1;
      const unit = s.interval_unit || "days";
      if (unit === "days") {
        return pl
          ? `Co ${val} ${val === 1 ? "dzień" : "dni"}`
          : `Every ${val} ${val === 1 ? "day" : "days"}`;
      }
      if (unit === "weeks") {
        return pl
          ? `Co ${val} ${val === 1 ? "tydzień" : "tyg."}`
          : `Every ${val} ${val === 1 ? "week" : "weeks"}`;
      }
      return pl
        ? `Co ${val} ${val === 1 ? "miesiąc" : "mies."}`
        : `Every ${val} ${val === 1 ? "month" : "months"}`;
    }
    return "";
  }

  // Współdzielona subskrypcja Supabase Realtime + odświeżanie po powrocie do karty (cooldown 30s)
  useMedicationRealtime({
    petId,
    onLog: (event) => {
      if (event.type === "UPSERT") {
        const incoming = event.log;
        setLogs((prev) => {
          const filtered = prev.filter(
            (l) =>
              l.id !== incoming.id &&
              !(
                l.schedule_id === incoming.schedule_id &&
                l.dose_date === incoming.dose_date &&
                l.scheduled_time === incoming.scheduled_time
              ),
          );
          return [incoming, ...filtered];
        });
      } else {
        setLogs((prev) => prev.filter((l) => l.id !== event.id));
      }
    },
    onSchedule: (event) => {
      if (event.type === "INSERT") {
        const incoming = event.schedule;
        setSchedules((prev) =>
          prev.some((s) => s.id === incoming.id)
            ? prev.map((s) => (s.id === incoming.id ? incoming : s))
            : [incoming, ...prev],
        );
      } else if (event.type === "UPDATE") {
        const incoming = event.schedule;
        setSchedules((prev) =>
          prev.map((s) => (s.id === incoming.id ? incoming : s)),
        );
      } else {
        setSchedules((prev) => prev.filter((s) => s.id !== event.id));
      }
    },
  });

  const todayDosesByScheduleId = useMemo(() => {
    const projected = projectMedicationDoses({
      schedules,
      logs,
      rangeStart: todayIso,
      rangeEnd: todayIso,
    });
    const map = new Map<string, ProjectedMedicationDose[]>();
    for (const dose of projected) {
      const list = map.get(dose.schedule_id) ?? [];
      list.push(dose);
      map.set(dose.schedule_id, list);
    }
    return map;
  }, [schedules, logs, todayIso]);

  // Szybka akcja podania lub pominięcia dawki bezpośrednio z karty z optymistyczną aktualizacją UI
  async function handleQuickRecordDose(
    dose: ProjectedMedicationDose,
    status: "taken" | "skipped",
    notes = "",
  ) {
    setBusyDoseKey(dose.key);

    const previousLogs = logs;
    const previousSchedules = schedules;
    const matchingSchedule = schedules.find((s) => s.id === dose.schedule_id);
    const optimisticLogId = createTempLogId();
    const optimisticLog: MedicationLog = {
      id: optimisticLogId,
      schedule_id: dose.schedule_id,
      pet_id: dose.pet_id,
      household_id: matchingSchedule?.household_id || "",
      dose_date: dose.dose_date,
      scheduled_time: dose.scheduled_time || "",
      administered_at: new Date().toISOString(),
      status,
      administered_by: currentUserId || null,
      notes,
      revision: 1,
      created_by: currentUserId || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Natychmiastowa optymistyczna zmiana w interfejsie (0ms)
    setLogs((prev) => {
      const filtered = prev.filter(
        (l) =>
          !(
            l.schedule_id === dose.schedule_id &&
            l.dose_date === dose.dose_date &&
            (l.scheduled_time === dose.scheduled_time ||
              (!l.scheduled_time && !dose.scheduled_time))
          ),
      );
      return [optimisticLog, ...filtered];
    });

    if (status === "taken" && !dose.is_completed) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === dose.schedule_id && s.stock_quantity != null
            ? { ...s, stock_quantity: Math.max(0, s.stock_quantity - 1) }
            : s,
        ),
      );
    } else if (status === "skipped" && dose.is_completed) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === dose.schedule_id && s.stock_quantity != null
            ? { ...s, stock_quantity: s.stock_quantity + 1 }
            : s,
        ),
      );
    }

    // 2. Asynchroniczny zapis na serwerze
    try {
      const client = createClient();
      let savedLog: MedicationLog | null = null;
      try {
        const { data: fnData, error: fnError } = await client.functions.invoke(
          "pet-medications",
          {
            body: {
              action: "record_dose",
              pet_id: dose.pet_id,
              schedule_id: dose.schedule_id,
              dose_date: dose.dose_date,
              scheduled_time: dose.scheduled_time,
              status,
              notes,
            },
          },
        );
        if (!fnError && fnData?.log) {
          savedLog = fnData.log as MedicationLog;
        }
      } catch {
        // Fallback do RPC
      }

      if (!savedLog) {
        const { data: rpcData, error: rpcError } = await client.rpc(
          "record_medication_dose",
          {
            p_schedule_id: dose.schedule_id,
            p_pet_id: dose.pet_id,
            p_dose_date: dose.dose_date,
            p_scheduled_time: dose.scheduled_time || "",
            p_status: status,
            p_notes: notes,
          },
        );
        if (!rpcError && rpcData) {
          savedLog = rpcData as MedicationLog;
        }
      }

      if (savedLog) {
        setLogs((prev) =>
          prev.map((l) => (l.id === optimisticLogId ? savedLog! : l)),
        );
        router.refresh();
      } else {
        // Rollback w przypadku błędu serwera
        setLogs(previousLogs);
        setSchedules(previousSchedules);
        alert(
          pl
            ? "Nie udało się zapisać podania dawki. Zmiana została cofnięta."
            : "Failed to record dose. Change was rolled back.",
        );
      }
    } catch (e) {
      console.error("Error recording dose:", e);
      setLogs(previousLogs);
      setSchedules(previousSchedules);
      alert(
        pl
          ? "Wystąpił błąd podczas zatwierdzania dawki. Zmiana została cofnięta."
          : "Error recording dose. Change was rolled back.",
      );
    } finally {
      setBusyDoseKey(null);
    }
  }

  return (
    <section className="pet-panel household-summary-reports household-summary-meds flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0">
            <IconPill size={16} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{pl ? "Aktywne leki i kuracje" : "Active Medications"}</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-semibold">
                {activeSchedules.length}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {schedules.length > activeSchedules.length && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode("active")}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  filterMode === "active"
                    ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {pl ? `Aktywne` : `Active`}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {pl ? `Wszystkie` : `All`}
              </button>
            </div>
          )}

          {/* Przycisk karty dla weterynarza */}
          {petData && (
            <button
              type="button"
              onClick={() => setSummaryModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-teal-700/50 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs transition-colors cursor-pointer"
              title={pl ? "Wygeneruj kartę leczenia i historii dla lekarza weterynarii" : "Generate veterinary treatment summary card"}
            >
              <IconPrinter size={13} className="text-teal-700 dark:text-teal-400" />
              <span className="hidden sm:inline">{pl ? "Karta leczenia" : "Rx Card"}</span>
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setEditingSchedule(null);
                setDialogOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title={pl ? "Zaplanuj lek, kurację lub kroplówkę" : "Schedule medication or fluid therapy"}
            >
              <IconPlus size={14} />
              <span>{pl ? "Zaplanuj" : "Add"}</span>
            </button>
          )}
        </div>
      </header>

      {displayedSchedules.length === 0 ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/30 gap-2">
          <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <IconPill size={18} />
          </span>
          <strong className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {filterMode === "active"
              ? pl
                ? "Brak aktywnych kuracji lekowych"
                : "No active medication treatments"
              : pl
                ? "Brak historii leków"
                : "No medication history"}
          </strong>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
            {pl
              ? "Możesz zaplanować podawanie leków stałych, doraźnych lub kuracji antybiotykowych."
              : "You can schedule ongoing, as-needed, or time-limited treatments."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 -mx-1 flex-1 min-h-0 overflow-y-auto pr-1">
          {displayedSchedules.map((s) => {
            const isFinished = !s.is_active || (s.end_date && s.end_date < todayIso);
            const times = parseScheduledTimes(s);

            // Zmemoizowana projekcja dzisiejszych dawek dla tego leku
            const todayDoses = todayDosesByScheduleId.get(s.id) ?? [];

            const isLowStock =
              s.stock_quantity != null &&
              s.stock_quantity <= (s.low_stock_threshold ?? 5);

            return (
              <li
                key={s.id}
                className={`py-2.5 px-2 flex flex-col gap-1.5 rounded-xl transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                  isFinished ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isFinished
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          : s.schedule_category === "fluid_therapy"
                            ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300"
                            : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
                      }`}
                    >
                      {s.schedule_category === "fluid_therapy" ? (
                        <IconDroplet size={16} />
                      ) : (
                        <IconPill size={16} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {s.name}
                        </strong>
                        {s.schedule_category === "fluid_therapy" && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-semibold">
                            {pl ? "Kroplówka" : "Fluid"}
                          </span>
                        )}
                        {s.dosage && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            {s.dosage}
                          </span>
                        )}
                        {s.stock_quantity != null && (
                          <span
                            className={`text-[11px] px-1.5 py-0.2 rounded-md font-medium ${
                              isLowStock
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-semibold"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {pl ? `Zapas: ${s.stock_quantity} ${s.stock_unit || "dawek"}` : `Stock: ${s.stock_quantity}`}
                          </span>
                        )}
                        {isFinished && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                            {pl ? "Zakończona" : "Finished"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-0.5">
                        <span className="text-teal-700 dark:text-teal-400 font-medium">
                          {formatScheduleType(s)}
                        </span>
                        <span>·</span>
                        <span>
                          {pl ? `Od ${s.start_date}` : `From ${s.start_date}`}
                          {s.end_date ? ` do ${s.end_date}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(s);
                        setDialogOpen(true);
                      }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
                      title={pl ? "Edytuj harmonogram leku" : "Edit medication schedule"}
                    >
                      <IconEdit size={14} />
                      <span>{pl ? "Edytuj" : "Edit"}</span>
                    </button>
                  )}
                </div>

                {/* Alert o niskim zapasie w apteczce */}
                {isLowStock && !isFinished && (
                  <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-900/60 ml-10">
                    <IconAlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {pl
                        ? `Kończy się lek: zostało tylko ${s.stock_quantity} ${s.stock_unit || "dawek"} — zamów receptę!`
                        : `Low medication stock: only ${s.stock_quantity} left — refill required!`}
                    </span>
                  </div>
                )}

                {/* Szybkie zatwierdzanie dzisiejszych dawek leku */}
                {!readOnly && todayDoses.length > 0 && !isFinished && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-10 pt-0.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-0.5">
                      <IconClock size={12} />
                      {pl ? "Dzisiaj:" : "Today:"}
                    </span>
                    {todayDoses.map((dose) => {
                      const isBusy = busyDoseKey === dose.key;
                      const adminTime = dose.log?.administered_at
                        ? new Intl.DateTimeFormat(locale, {
                            timeStyle: "short",
                            timeZone: "Europe/Warsaw",
                          }).format(new Date(dose.log.administered_at))
                        : "";
                      const adminPerson = dose.log?.administered_by
                        ? dose.log.administered_by === currentUserId
                          ? pl
                            ? "Ciebie"
                            : "You"
                          : memberNames[dose.log.administered_by] ||
                            (pl ? "domownika" : "member")
                        : pl
                          ? "domownika"
                          : "member";

                      if (dose.is_completed) {
                        return (
                          <span
                            key={dose.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 text-[11px] font-medium"
                            title={pl ? `Podano o ${adminTime} przez: ${adminPerson}` : `Given at ${adminTime} by: ${adminPerson}`}
                          >
                            <IconCheck size={12} className="text-emerald-600 shrink-0" />
                            <span className="font-mono font-semibold">{dose.scheduled_time || "—"}</span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                              ✓ {adminPerson}
                            </span>
                          </span>
                        );
                      }

                      if (dose.is_skipped) {
                        return (
                          <span
                            key={dose.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 text-[11px] font-medium"
                            title={dose.log?.notes ? `Pominięto: ${dose.log.notes}` : "Pominięto"}
                          >
                            <span className="font-mono">{dose.scheduled_time || "—"}</span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400">
                              ⊘ {pl ? "Pominięto" : "Skipped"}
                            </span>
                          </span>
                        );
                      }

                      // Dawka oczekująca na podanie (Quick Action)
                      return (
                        <div key={dose.key} className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleQuickRecordDose(dose, "taken")}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-l-md bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                            title={pl ? `Zatwierdź podanie o ${dose.scheduled_time}` : `Mark dose at ${dose.scheduled_time} as given`}
                          >
                            <IconCheck size={12} />
                            <span>{dose.scheduled_time || (pl ? "Podaj" : "Give")}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setSkippingDose(dose)}
                            className="px-1.5 py-0.5 rounded-r-md bg-teal-800 hover:bg-teal-900 text-teal-100 hover:text-amber-200 text-[10px] font-medium transition-colors cursor-pointer border-l border-teal-600 disabled:opacity-50"
                            title={pl ? "Pomiń tę dawkę" : "Skip this dose"}
                          >
                            {pl ? "Pomiń" : "Skip"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Planowane godziny podawania (gdy brak dawek dzisiaj) */}
                {todayDoses.length === 0 && times.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-10">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <IconClock size={12} />
                      {pl ? "Pory:" : "Times:"}
                    </span>
                    {times.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-mono font-medium border border-teal-200/50 dark:border-teal-900/40"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {s.instructions && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg pl-10">
                    <IconNotes size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="italic">{s.instructions}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Stopka karty z płynnym przewijaniem do sekcji kalendarza */}
      <a
        href="#terminarz"
        onClick={(e) => {
          const el = document.getElementById("terminarz");
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth" });
          }
        }}
        className="household-summary-link"
      >
        {pl ? "Przejdź do terminarza leków ↓" : "Go to medication schedule ↓"}
      </a>

      {dialogOpen && (
        <MedicationDialog
          pets={pets}
          defaultPetId={petId}
          schedule={editingSchedule}
          onClose={() => {
            setDialogOpen(false);
            setEditingSchedule(null);
          }}
          onSave={(saved) => {
            setSchedules((prev) => {
              const exists = prev.some((row) => row.id === saved.id);
              return exists
                ? prev.map((row) => (row.id === saved.id ? saved : row))
                : [saved, ...prev];
            });
            setDialogOpen(false);
            setEditingSchedule(null);
            router.refresh();
          }}
          onDelete={(id) => {
            setSchedules((prev) => prev.filter((row) => row.id !== id));
            setDialogOpen(false);
            setEditingSchedule(null);
            router.refresh();
          }}
        />
      )}

      {/* Modal pomijania dawki */}
      {skippingDose && (
        <SkipDoseDialog
          dose={skippingDose}
          petName={petName}
          onClose={() => setSkippingDose(null)}
          onConfirm={async (notes) => {
            await handleQuickRecordDose(skippingDose, "skipped", notes);
            setSkippingDose(null);
          }}
        />
      )}

      {/* Modal karty leczenia dla weterynarza */}
      {summaryModalOpen && petData && (
        <TreatmentSummaryModal
          pet={petData}
          weight={weight}
          schedules={schedules}
          logs={logs}
          reports={reports}
          keyParameters={keyParameters}
          onClose={() => setSummaryModalOpen(false)}
        />
      )}
    </section>
  );
}
