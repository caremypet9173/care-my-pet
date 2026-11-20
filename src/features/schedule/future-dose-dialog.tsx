"use client";

import "@/styles/history-dialog.css";
import "@/styles/weight.css";
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { IconClock, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { ProjectedMedicationDose } from "@/features/medications/types";

export function FutureDoseDialog({
  dose,
  petName,
  onClose,
}: {
  dose: ProjectedMedicationDose;
  petName?: string;
  onClose: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={dialog}
      className="weight-dialog history-dialog"
      aria-labelledby="future-dose-dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="p-1">
        <header className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IconClock size={22} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h3
              id="future-dose-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100 m-0"
            >
              {pl ? "Zaplanowana przyszła dawka" : "Scheduled future dose"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 m-0">
              {pl
                ? "Podanie leku można zatwierdzić dopiero w wyznaczonym dniu"
                : "Confirmation is available only on dose date"}
            </p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="py-4 space-y-3">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs leading-relaxed text-amber-950 dark:text-amber-200">
            <p className="m-0 font-medium">
              {pl ? (
                <>
                  Lek <strong>„{dose.name}”</strong>
                  {dose.dosage ? ` (${dose.dosage})` : ""}
                  {petName ? ` dla pupila ${petName}` : ""} jest zaplanowany na termin{" "}
                  <strong>{dose.dose_date}</strong>
                  {dose.scheduled_time ? ` o godz. ${dose.scheduled_time}` : ""}.
                </>
              ) : (
                <>
                  Medication <strong>&ldquo;{dose.name}&rdquo;</strong>
                  {dose.dosage ? ` (${dose.dosage})` : ""}
                  {petName ? ` for ${petName}` : ""} is scheduled for{" "}
                  <strong>{dose.dose_date}</strong>
                  {dose.scheduled_time ? ` at ${dose.scheduled_time}` : ""}.
                </>
              )}
            </p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 m-0 leading-relaxed">
            {pl
              ? "Ze względów bezpieczeństwa i rzetelności historii leczenia, zatwierdzenie podania jest możliwe w bieżącym dniu lub dla dawek zaległych. Wróć do tej dawki w wyznaczonym terminie, aby odnotować jej przyjęcie."
              : "To ensure treatment accuracy, dose confirmation is available on the scheduled date or for overdue doses. Please return on that date to confirm intake."}
          </p>
        </div>

        <footer className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            {pl ? "Rozumiem" : "Got it"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
