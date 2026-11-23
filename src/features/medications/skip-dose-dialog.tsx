"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { IconAlertTriangle, IconBan, IconX } from "@tabler/icons-react";
import type { ProjectedMedicationDose } from "./types";

interface Props {
  dose: ProjectedMedicationDose;
  petName?: string;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void> | void;
  isSaving?: boolean;
}

export function SkipDoseDialog({
  dose,
  petName,
  onClose,
  onConfirm,
  isSaving = false,
}: Props) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [notes, setNotes] = useState("");

  const quickReasons = pl
    ? [
        "Odmówił przyjęcia",
        "Zwymiotował lek",
        "Zalecenie lekarza",
        "Brak leku w apteczce",
        "Poprawa stanu zdrowia",
      ]
    : [
        "Refused to take",
        "Vomited medication",
        "Vet's advice",
        "Ran out of medicine",
        "Condition improved",
      ];

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    if (!el.open) {
      el.showModal();
    }
    return () => {
      if (el.open) el.close();
      prevFocus?.focus();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    await onConfirm(notes.trim());
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="skip-dose-title"
      className="m-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-900/40 p-0 text-slate-800 dark:text-slate-100 backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs"
      onCancel={(e) => {
        e.preventDefault();
        if (!isSaving) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isSaving) onClose();
      }}
    >
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <IconAlertTriangle size={22} aria-hidden="true" />
            </span>
            <div>
              <h3 id="skip-dose-title" className="text-lg font-bold">
                {pl ? "Pomiń dawkę leku" : "Skip medication dose"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pl
                  ? "Odnotuj pominięcie dawki w historii leczenia"
                  : "Record skipped dose in medical history"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            {dose.name} {dose.dosage ? `(${dose.dosage})` : ""}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
            {petName && (
              <span>
                {pl ? "Pupil: " : "Pet: "}
                <strong>{petName}</strong>
              </span>
            )}
            <span>
              {pl ? "Data: " : "Date: "}
              <strong>{dose.dose_date}</strong>
              {dose.scheduled_time ? ` ${dose.scheduled_time}` : ""}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="skip-notes"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {pl ? "Powód pominięcia (opcjonalnie)" : "Reason for skipping (optional)"}
            </label>
            <textarea
              id="skip-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                pl
                  ? "np. Odmówił zjedzenia karmy, zwymiotował, zalecono odstawienie..."
                  : "e.g. Refused to eat, vomited, advised by vet to stop..."
              }
              rows={3}
              maxLength={500}
              disabled={isSaving}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all resize-none"
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setNotes((prev) =>
                      prev ? `${prev}, ${reason.toLowerCase()}` : reason,
                    )
                  }
                  className="text-[11px] px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 transition-colors cursor-pointer"
                >
                  + {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 min-h-[44px] text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {pl ? "Anuluj" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <IconBan size={15} aria-hidden="true" />
              <span>
                {isSaving
                  ? pl
                    ? "Zapisywanie..."
                    : "Saving..."
                  : pl
                    ? "Potwierdź pominięcie"
                    : "Confirm skip"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
