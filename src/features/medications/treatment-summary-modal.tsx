"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import {
  IconCheck,
  IconAlertCircle,
  IconFlask,
  IconPill,
  IconPrinter,
  IconScale,
  IconX,
} from "@tabler/icons-react";
import type { MedicationLog, MedicationSchedule } from "./types";
import { projectMedicationDoses } from "./projection";

type PetSummaryData = {
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
};

type Props = {
  pet: PetSummaryData;
  weight: { kg: number; measured_on: string } | null;
  schedules: MedicationSchedule[];
  logs: MedicationLog[];
  reports?: Array<{ id: string; title: string; test_date: string; laboratory?: string | null }>;
  keyParameters?: Array<{ row: { name: string; value: string; unit: string; note?: string }; date: string }>;
  onClose: () => void;
};

export function TreatmentSummaryModal({
  pet,
  weight,
  schedules,
  logs,
  reports = [],
  keyParameters = [],
  onClose,
}: Props) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current!;
    const previous = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const activeSchedules = schedules.filter(
    (s) => s.is_active && (!s.end_date || s.end_date >= today),
  );

  // Analiza adherence z ostatnich 30 dni
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(thirtyDaysAgo);

  const pastDoses = projectMedicationDoses({
    schedules,
    logs,
    rangeStart: thirtyDaysAgoIso,
    rangeEnd: today,
  });

  const completedDoses = pastDoses.filter((d) => d.is_completed);
  const skippedDoses = pastDoses.filter((d) => d.is_skipped);
  const totalDueDoses = pastDoses.length;
  const adherenceRate =
    totalDueDoses > 0
      ? Math.round((completedDoses.length / totalDueDoses) * 100)
      : 100;

  function handlePrint() {
    window.print();
  }

  return (
    <dialog
      ref={dialog}
      className="weight-dialog treatment-summary-dialog max-w-4xl w-[95vw] p-0 rounded-2xl shadow-2xl backdrop:bg-slate-900/60 overflow-hidden"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      {/* Pasek akcji ekranowych - ukryty przy wydruku */}
      <div className="no-print flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <IconPill size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold m-0 text-white">
              {pl
                ? `Karta leczenia i historii zdrowia — ${pet.imie}`
                : `Treatment & Health History Card — ${pet.imie}`}
            </h3>
            <p className="text-xs text-slate-400 m-0">
              {pl
                ? "Format zoptymalizowany pod kątem wizyt weterynaryjnych i wydruku A4"
                : "Optimized for veterinary visits and A4 printing"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <IconPrinter size={16} />
            <span>{pl ? "Drukuj / Pobierz PDF" : "Print / Save PDF"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} />
          </button>
        </div>
      </div>

      {/* Obszar wydruku / Podgląd dokumentu medycznego */}
      <div className="treatment-print-document max-h-[80vh] overflow-y-auto p-6 md:p-8 bg-white text-slate-900 font-sans">
        {/* Nagłówek dokumentu medycznego */}
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase text-teal-800 block mb-1">
                Care My Pet · Dokumentacja leczenia
              </span>
              <h1 className="text-2xl font-black text-slate-950 m-0">
                {pl ? "Karta leczenia i profilu pacjenta" : "Patient Treatment & Clinical Profile"}
              </h1>
              <p className="text-xs text-slate-600 mt-1 m-0">
                {pl ? "Raport wygenerowany dla lekarza weterynarii" : "Clinical report generated for veterinary visit"}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <strong className="block text-sm text-slate-900 font-bold">
                {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date())}
              </strong>
              <span>
                {pl ? "Godzina wydruku: " : "Printed at: "}
                {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date())}
              </span>
            </div>
          </div>

          {/* Karta danych pacjenta */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Pacjent (Imię):" : "Patient Name:"}</span>
              <strong className="text-sm font-bold text-slate-900">{pet.imie}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Gatunek i rasa:" : "Species & Breed:"}</span>
              <strong className="text-slate-800 font-semibold">
                {pl ? (pet.gatunek === "cat" ? "Kot" : "Pies") : pet.gatunek}
                {pet.rasa ? ` · ${pet.rasa}` : ""}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Płeć / Kastracja:" : "Sex / Neutered:"}</span>
              <span className="text-slate-800 font-semibold">
                {pl ? (pet.plec === "female" ? "Samica" : pet.plec === "male" ? "Samiec" : "Nieznana") : pet.plec}
                {pet.kastracja ? ` (${pl ? "Kastrowany" : "Neutered"})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Aktualna masa ciała:" : "Current Weight:"}</span>
              <strong className="text-teal-900 font-bold flex items-center gap-1">
                <IconScale size={13} className="text-teal-700 inline" />
                {weight ? `${weight.kg} kg` : (pl ? "Brak pomiaru" : "No record")}
                {weight && <small className="font-normal text-slate-500">({weight.measured_on})</small>}
              </strong>
            </div>
            {pet.numer_id && (
              <div className="col-span-2">
                <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Identyfikator (Chip/Tatuaż):" : "Microchip ID:"}</span>
                <span className="font-mono text-slate-800">{pet.numer_id}</span>
              </div>
            )}
            {pet.notatki && (
              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200/80">
                <span className="text-slate-500 block text-[11px] font-medium">{pl ? "Ważne uwagi opiekuna / Alergie:" : "Owner Notes / Allergies:"}</span>
                <p className="text-slate-800 italic m-0 mt-0.5">{pet.notatki}</p>
              </div>
            )}
          </div>
        </header>

        {/* Sekcja 1: Aktualnie podawane leki i kuracje */}
        <section className="mb-6">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center">
                <IconPill size={14} />
              </span>
              <span>{pl ? "1. Aktywne leki i harmonogram kuracji" : "1. Active Medication Regimen"}</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              {pl ? `${activeSchedules.length} pozycji` : `${activeSchedules.length} active`}
            </span>
          </div>

          {activeSchedules.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              {pl ? "Brak aktywnych zleceń lekowych na dzień dzisiejszy." : "No active medication schedules."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2 px-3">{pl ? "Lek / Preparat" : "Medication"}</th>
                    <th className="py-2 px-3">{pl ? "Dawka" : "Dosage"}</th>
                    <th className="py-2 px-3">{pl ? "Częstotliwość" : "Frequency"}</th>
                    <th className="py-2 px-3">{pl ? "Godziny podawania" : "Times"}</th>
                    <th className="py-2 px-3">{pl ? "Okres terapii" : "Period"}</th>
                    <th className="py-2 px-3">{pl ? "Zalecenia podania" : "Instructions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeSchedules.map((s) => {
                    const times = s.scheduled_times?.length ? s.scheduled_times : (s.scheduled_time ? [s.scheduled_time] : []);
                    const freq = s.schedule_type === "daily"
                      ? (pl ? `Codziennie (${times.length}×)` : `Daily (${times.length}×)`)
                      : s.schedule_type === "interval"
                        ? (pl ? `Co ${s.interval_value} ${s.interval_unit}` : `Every ${s.interval_value} ${s.interval_unit}`)
                        : (pl ? "Jednorazowo / Doraźnie" : "One-off / As needed");

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {s.name}
                          {s.stock_quantity != null && (
                            <span className="block text-[10px] text-slate-500 font-normal">
                              {pl ? `Zapas: ${s.stock_quantity} ${s.stock_unit || "dawek"}` : `Stock: ${s.stock_quantity}`}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{s.dosage || "—"}</td>
                        <td className="py-2.5 px-3 text-slate-700">{freq}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {times.map((t, idx) => (
                              <span key={idx} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {pl ? `od ${s.start_date}` : `from ${s.start_date}`}
                          {s.end_date ? ` do ${s.end_date}` : (pl ? " (stała)" : " (ongoing)")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 italic">
                          {s.instructions || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Sekcja 2: Wskaźnik adherence i historia ostatnich 30 dni */}
        <section className="mb-6">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <IconCheck size={14} />
              </span>
              <span>{pl ? "2. Regularność podawania dawek (ostatnie 30 dni)" : "2. Medication Adherence (last 30 days)"}</span>
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600">{pl ? "Zgodność terapii:" : "Adherence rate:"}</span>
              <strong className="text-emerald-700 text-sm font-bold">{adherenceRate}%</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-800 block font-medium">{pl ? "Podane dawki:" : "Completed doses:"}</span>
              <strong className="text-xl font-black text-emerald-900">{completedDoses.length}</strong>
              <small className="block text-emerald-700 mt-0.5">{pl ? "zatwierdzone przez opiekunów" : "logged as given"}</small>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-amber-800 block font-medium">{pl ? "Pominięte dawki:" : "Skipped doses:"}</span>
              <strong className="text-xl font-black text-amber-900">{skippedDoses.length}</strong>
              <small className="block text-amber-700 mt-0.5">{pl ? "z odnotowaną przyczyną" : "with logged reason"}</small>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-700 block font-medium">{pl ? "Wszystkie zaplanowane:" : "Total planned doses:"}</span>
              <strong className="text-xl font-black text-slate-900">{totalDueDoses}</strong>
              <small className="block text-slate-500 mt-0.5">{pl ? "w okresie ostatnich 30 dni" : "in the last 30 days"}</small>
            </div>
          </div>

          {skippedDoses.length > 0 && (
            <div className="mt-2 p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs">
              <strong className="text-amber-900 block font-semibold mb-1 flex items-center gap-1">
                <IconAlertCircle size={14} className="text-amber-700" />
                {pl ? "Odnotowane pominięcia dawek:" : "Recorded dose omissions:"}
              </strong>
              <ul className="divide-y divide-amber-200/50 -my-1">
                {skippedDoses.map((sk) => (
                  <li key={sk.key} className="py-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-800 font-medium">
                      {sk.dose_date} {sk.scheduled_time && `(${sk.scheduled_time})`} · <strong>{sk.name}</strong>
                    </span>
                    <span className="text-amber-800 italic">
                      {sk.log?.notes ? sk.log.notes : (pl ? "Brak wpisanej przyczyny" : "No reason provided")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Sekcja 3: Ostatnie badania diagnostyczne i kluczowe parametry */}
        {(reports.length > 0 || keyParameters.length > 0) && (
          <section className="mb-6">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center">
                  <IconFlask size={14} />
                </span>
                <span>{pl ? "3. Badania laboratoryjne i kluczowe parametry" : "3. Diagnostic Reports & Key Parameters"}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {reports.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1.5">{pl ? "Ostatnie badania:" : "Recent tests:"}</h3>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {reports.slice(0, 4).map((r) => (
                      <li key={r.id} className="p-2 flex items-start justify-between gap-2 bg-slate-50/50">
                        <strong className="text-slate-900 font-medium">{r.title}</strong>
                        <span className="text-slate-500 text-[11px] whitespace-nowrap">{r.test_date}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {keyParameters.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1.5">{pl ? "Kluczowe parametry krwi/moczu:" : "Key biomarkers:"}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {keyParameters.slice(0, 6).map(({ row, date }, i) => (
                      <div key={i} className="p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[10px] text-slate-500 block truncate">{row.name} · {date}</span>
                        <strong className="text-xs text-slate-900">{row.value} {row.unit}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sekcja 4: Miejsce na notatki i pieczątkę lekarza */}
        <section className="mt-8 pt-4 border-t-2 border-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl border border-dashed border-slate-300 min-h-[100px] flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {pl ? "Zalecenia i modyfikacje leczenia (notatka lekarza):" : "Veterinary Recommendations & Adjustments:"}
              </span>
              <div className="border-b border-slate-200 my-2" />
              <div className="border-b border-slate-200 my-2" />
              <div className="border-b border-slate-200 my-2" />
            </div>

            <div className="p-4 rounded-xl border border-dashed border-slate-300 min-h-[100px] flex flex-col justify-between items-center text-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block w-full text-left">
                {pl ? "Pieczęć i podpis lekarza weterynarii:" : "Veterinary Signature & Stamp:"}
              </span>
              <div className="w-48 border-b border-slate-400 mt-12 mb-1" />
              <small className="text-slate-400">{pl ? "Podpis i data" : "Signature & date"}</small>
            </div>
          </div>
        </section>

        {/* Stopka techniczna */}
        <footer className="mt-6 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Care My Pet · System zarządzania zdrowiem zwierząt domowych · Raport wygenerowany elektronicznie
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .treatment-summary-dialog,
          .treatment-print-document,
          .treatment-print-document * {
            visibility: visible !important;
          }
          .treatment-summary-dialog {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
          }
          .treatment-print-document {
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </dialog>
  );
}
