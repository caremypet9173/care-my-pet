"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconClock,
  IconEdit,
  IconNotes,
  IconPill,
  IconPlus,
} from "@tabler/icons-react";
import { MedicationDialog } from "./medication-dialog";
import type { MedicationSchedule } from "./types";

interface Props {
  petId: string;
  petName: string;
  initialSchedules: MedicationSchedule[];
  pets: { id: string; imie: string }[];
}

export function ActiveMedicationsCard({
  petId,
  petName,
  initialSchedules,
  pets,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const pl = locale === "pl";

  const [schedules, setSchedules] =
    useState<MedicationSchedule[]>(initialSchedules);
  const [filterMode, setFilterMode] = useState<"active" | "all">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<MedicationSchedule | null>(null);

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

  return (
    <section className="pet-panel household-summary-reports bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0">
            <IconPill size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{pl ? "Aktywne leki i kuracje" : "Active Medications"}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-semibold">
                {activeSchedules.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pl
                ? `Plan leczenia i suplementacji dla ${petName}`
                : `Treatment and supplement plan for ${petName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {schedules.length > activeSchedules.length && (
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("active")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  filterMode === "active"
                    ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {pl ? `Aktywne (${activeSchedules.length})` : `Active (${activeSchedules.length})`}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  filterMode === "all"
                    ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {pl ? `Wszystkie (${schedules.length})` : `All (${schedules.length})`}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingSchedule(null);
              setDialogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <IconPlus size={15} />
            <span>{pl ? "Dodaj lek" : "Add medication"}</span>
          </button>
        </div>
      </header>

      {displayedSchedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/30 gap-2">
          <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <IconPill size={20} />
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
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
          {displayedSchedules.map((s) => {
            const isFinished = !s.is_active || (s.end_date && s.end_date < todayIso);
            const times =
              s.scheduled_times && s.scheduled_times.length > 0
                ? s.scheduled_times
                : s.scheduled_time
                  ? [s.scheduled_time]
                  : [];

            return (
              <li
                key={s.id}
                className={`py-3.5 px-2 flex flex-col gap-2 rounded-xl transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                  isFinished ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isFinished
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
                      }`}
                    >
                      <IconPill size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {s.name}
                        </strong>
                        {s.dosage && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                            {s.dosage}
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
                </div>

                {times.length > 0 && (
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
    </section>
  );
}
