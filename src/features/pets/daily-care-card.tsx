"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconDroplet,
  IconHeartRateMonitor,
  IconPill,
  IconScale,
  IconSparkles,
  IconStethoscope,
  IconTemperature,
  IconX,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { projectMedicationDoses } from "@/features/medications/projection";
import type {
  MedicationLog,
  MedicationSchedule,
  ProjectedMedicationDose,
} from "@/features/medications/types";
import type { ScheduleItem } from "@/features/schedule/types";
import type { PetFluidTherapy } from "@/features/fluid-therapy/types";
import type { VitalMeasurement } from "@/features/measurements/types";
import type { WeightMeasurement } from "@/features/weight/types";

const SkipDoseDialog = dynamic(
  () =>
    import("@/features/medications/skip-dose-dialog").then(
      (m) => m.SkipDoseDialog,
    ),
  { ssr: false },
);

function createTempLogId(): string {
  return `temp-${Date.now()}`;
}

interface DailyCareCardProps {
  petId: string;
  petName: string;
  schedules: MedicationSchedule[];
  initialLogs: MedicationLog[];
  scheduleItems: ScheduleItem[];
  fluids: PetFluidTherapy[];
  vitalMeasurements: VitalMeasurement[];
  weights: WeightMeasurement[];
  memberNames?: Record<string, string>;
  readOnly?: boolean;
}

export function DailyCareCard({
  petName,
  schedules,
  initialLogs,
  scheduleItems,
  fluids,
  vitalMeasurements,
  weights,
  memberNames = {},
  readOnly = false,
}: DailyCareCardProps) {
  const router = useRouter();
  const locale = useLocale();
  const pl = locale === "pl";

  const [prevInitialLogs, setPrevInitialLogs] = useState(initialLogs);
  const [logs, setLogs] = useState<MedicationLog[]>(initialLogs);
  if (initialLogs !== prevInitialLogs) {
    setPrevInitialLogs(initialLogs);
    setLogs(initialLogs);
  }
  const [skippingDose, setSkippingDose] =
    useState<ProjectedMedicationDose | null>(null);
  const [busyDoseKey, setBusyDoseKey] = useState<string | null>(null);

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Warsaw",
      }).format(new Date()),
    [],
  );

  const todayFormatted = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [locale],
  );

  // Projected medication doses for today
  const todayDoses = useMemo(() => {
    const activeSchedules = schedules.filter(
      (s) => s.is_active && (!s.end_date || s.end_date >= todayIso),
    );
    return projectMedicationDoses({
      schedules: activeSchedules,
      logs,
      rangeStart: todayIso,
      rangeEnd: todayIso,
    });
  }, [schedules, logs, todayIso]);
  const completedDoses = todayDoses.filter((d) => d.is_completed);
  const pendingDoses = todayDoses.filter((d) => !d.is_completed && !d.is_skipped);

  // Planned calendar items for today
  const todayVisits = scheduleItems.filter(
    (it) => it.scheduled_date === todayIso && it.status === "planned",
  );

  // Measurements & fluids recorded today
  const todayWeights = weights.filter((w) => w.measured_on === todayIso);
  const todayBP = vitalMeasurements.find(
    (v) => v.metric_type === "blood_pressure" && v.measured_on === todayIso,
  );
  const todayGlucose = vitalMeasurements.find(
    (v) => v.metric_type === "glucose" && v.measured_on === todayIso,
  );
  const todayTemp = vitalMeasurements.find(
    (v) => v.metric_type === "temperature" && v.measured_on === todayIso,
  );
  const todayFluids = fluids.filter((f) => f.administered_on === todayIso);
  const doseLogIds = new Set(todayDoses.map((d) => d.log?.id).filter(Boolean));
  const visibleTodayFluids = todayFluids.filter(
    (f) => !f.medication_log_id || !doseLogIds.has(f.medication_log_id),
  );
  const hasFluidDoses = todayDoses.some(
    (d) => d.schedule_category === "fluid_therapy",
  );

  // If there are no medication doses, visits or fluids scheduled/recorded for today,
  // do not render an empty card.
  const hasTasksToday =
    todayDoses.length > 0 ||
    todayVisits.length > 0 ||
    visibleTodayFluids.length > 0;
  if (!hasTasksToday) {
    return null;
  }

  async function handleToggleDose(
    dose: ProjectedMedicationDose,
    status: "taken" | "skipped",
    notes = "",
  ) {
    if (busyDoseKey) return;
    setBusyDoseKey(dose.key);

    const previousLogs = [...logs];
    const optimisticLogId = createTempLogId();

    if (dose.is_completed || dose.is_skipped) {
      // Revert/uncheck
      if (dose.log?.id) {
        setLogs((prev) => prev.filter((l) => l.id !== dose.log?.id));
        try {
          const client = createClient();
          const { error } = await client.rpc("delete_medication_dose_log", {
            p_log_id: dose.log.id,
          });
          if (error) {
            setLogs(previousLogs);
          } else {
            router.refresh();
          }
        } catch {
          setLogs(previousLogs);
        } finally {
          setBusyDoseKey(null);
        }
      } else {
        setBusyDoseKey(null);
      }
      return;
    }

    // Optimistic insert
    const optimisticLog: MedicationLog = {
      id: optimisticLogId,
      schedule_id: dose.schedule_id,
      pet_id: dose.pet_id,
      household_id: "",
      dose_date: dose.dose_date,
      scheduled_time: dose.scheduled_time,
      administered_at: new Date().toISOString(),
      status,
      administered_by: null,
      notes,
      revision: 1,
      created_by: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLogs((prev) => [optimisticLog, ...prev]);

    try {
      const client = createClient();
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
        setLogs((prev) =>
          prev.map((l) => (l.id === optimisticLogId ? (rpcData as MedicationLog) : l)),
        );
        router.refresh();
      } else {
        setLogs(previousLogs);
      }
    } catch {
      setLogs(previousLogs);
    } finally {
      setBusyDoseKey(null);
    }
  }

  const allDosesDone = todayDoses.length > 0 && pendingDoses.length === 0;

  return (
    <section
      className="daily-care-card pet-panel"
      aria-label={pl ? "Dzienny pulpit opieki" : "Daily care hub"}
    >
      <header className="daily-care-header">
        <div className="daily-care-title-block">
          <div className="daily-care-badge-row">
            <span className="daily-care-icon-badge" aria-hidden="true">
              <IconSparkles size={16} />
            </span>
            <span className="daily-care-kicker">
              {pl ? "Dzienny plan opieki" : "Daily Care Plan"}
            </span>
          </div>
          <h2 className="daily-care-title">
            {todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}
          </h2>
        </div>

        <div className="daily-care-status-summary">
          {todayDoses.length > 0 ? (
            <span
              className={`daily-care-pill-badge${
                allDosesDone ? " is-complete" : " is-pending"
              }`}
            >
              {allDosesDone ? (
                <>
                  <IconCheck size={14} aria-hidden="true" />
                  <span>
                    {pl ? "Wszystkie leki podane!" : "All doses completed!"}
                  </span>
                </>
              ) : (
                <>
                  <IconClock size={14} aria-hidden="true" />
                  <span>
                    {pl
                      ? `${completedDoses.length} z ${todayDoses.length} dawek`
                      : `${completedDoses.length} of ${todayDoses.length} doses`}
                  </span>
                </>
              )}
            </span>
          ) : todayVisits.length > 0 ? (
            <span className="daily-care-pill-badge is-visit">
              <IconCalendar size={14} aria-hidden="true" />
              <span>
                {pl ? `${todayVisits.length} wizyta dzisiaj` : "Visit today"}
              </span>
            </span>
          ) : todayFluids.length > 0 ? (
            <span className="daily-care-pill-badge is-complete">
              <IconCheck size={14} aria-hidden="true" />
              <span>
                {pl
                  ? `Kroplówka podana (${todayFluids[0].volume_ml} ml)`
                  : `Infusion done (${todayFluids[0].volume_ml} ml)`}
              </span>
            </span>
          ) : (
            <span className="daily-care-pill-badge is-quiet">
              <IconCheck size={14} aria-hidden="true" />
              <span>{pl ? "Spokojny dzień" : "Quiet day"}</span>
            </span>
          )}
        </div>
      </header>

      {/* 1. Planned medication doses for today */}
      {todayDoses.length > 0 && (
        <div className="daily-care-section">
          <h3 className="daily-care-section-title">
            {hasFluidDoses ? (
              <IconDroplet size={16} aria-hidden="true" />
            ) : (
              <IconPill size={16} aria-hidden="true" />
            )}
            <span>
              {hasFluidDoses
                ? pl
                  ? "Leki i kroplówki zaplanowane na dziś"
                  : "Medications & fluids today"
                : pl
                  ? "Leki zaplanowane na dziś"
                  : "Today's medications"}
            </span>
          </h3>

          <ul className="daily-care-dose-list">
            {todayDoses.map((dose) => {
              const isBusy = busyDoseKey === dose.key;
              const isFluidDose = dose.schedule_category === "fluid_therapy";
              const givenByName =
                dose.log?.administered_by && memberNames[dose.log.administered_by]
                  ? memberNames[dose.log.administered_by]
                  : null;

              return (
                <li
                  key={dose.key}
                  className={`daily-care-dose-item${
                    isFluidDose ? " is-fluid-dose" : ""
                  }${
                    dose.is_completed
                      ? " is-completed"
                      : dose.is_skipped
                        ? " is-skipped"
                        : " is-pending"
                  }`}
                >
                  <div className="daily-care-dose-info">
                    <div className="daily-care-dose-header">
                      {dose.scheduled_time && (
                        <span className="daily-care-dose-time">
                          {dose.scheduled_time.slice(0, 5)}
                        </span>
                      )}
                      {isFluidDose && (
                        <span className="daily-care-dose-badge-fluid">
                          <IconDroplet size={12} aria-hidden="true" />
                          {pl ? "Kroplówka" : "Fluid"}
                        </span>
                      )}
                      <strong className="daily-care-dose-name">{dose.name}</strong>
                      {dose.dosage && (
                        <span className="daily-care-dose-dosage">
                          ({dose.dosage})
                        </span>
                      )}
                    </div>

                    {dose.instructions && (
                      <p className="daily-care-dose-instructions">
                        {dose.instructions}
                      </p>
                    )}

                    {dose.is_completed && (
                      <small className="daily-care-dose-meta">
                        ✓ {pl ? "Podano" : "Administered"}
                        {givenByName ? ` (${givenByName})` : ""}
                      </small>
                    )}

                    {dose.is_skipped && (
                      <small className="daily-care-dose-meta is-skipped">
                        ✕ {pl ? "Pominięto" : "Skipped"}
                        {dose.log?.notes ? `: ${dose.log.notes}` : ""}
                      </small>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="daily-care-dose-actions">
                      {dose.is_completed ? (
                        <button
                          type="button"
                          className="daily-care-btn-uncheck"
                          disabled={isBusy}
                          onClick={() => void handleToggleDose(dose, "taken")}
                          title={pl ? "Cofnij oznaczenie" : "Uncheck dose"}
                        >
                          <IconCheck size={16} aria-hidden="true" />
                          <span>{pl ? "Podano" : "Done"}</span>
                        </button>
                      ) : dose.is_skipped ? (
                        <button
                          type="button"
                          className="daily-care-btn-uncheck is-skipped"
                          disabled={isBusy}
                          onClick={() => void handleToggleDose(dose, "skipped")}
                          title={pl ? "Cofnij pominięcie" : "Unskip dose"}
                        >
                          <IconX size={15} aria-hidden="true" />
                          <span>{pl ? "Pominięto" : "Skipped"}</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="daily-care-btn-take"
                            disabled={isBusy}
                            onClick={() => void handleToggleDose(dose, "taken")}
                          >
                            <IconCheck size={16} aria-hidden="true" />
                            <span>{pl ? "Podaj" : "Give"}</span>
                          </button>
                          <button
                            type="button"
                            className="daily-care-btn-skip"
                            disabled={isBusy}
                            onClick={() => setSkippingDose(dose)}
                          >
                            {pl ? "Pomiń" : "Skip"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 2. Today's visits & calendar events */}
      {todayVisits.length > 0 && (
        <div className="daily-care-section">
          <h3 className="daily-care-section-title">
            <IconCalendar size={16} aria-hidden="true" />
            <span>{pl ? "Zaplanowane na dziś w kalendarzu" : "Calendar events today"}</span>
          </h3>
          <ul className="daily-care-visit-list">
            {todayVisits.map((item) => (
              <li key={item.id} className="daily-care-visit-item">
                <IconStethoscope size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {item.scheduled_time ? `${item.scheduled_time.slice(0, 5)} ` : ""}
                    {item.title}
                  </strong>
                  {(item.clinic || item.doctor) && (
                    <small>
                      {[item.clinic, item.doctor].filter(Boolean).join(" · ")}
                    </small>
                  )}
                  {item.prep_notes && (
                    <p className="daily-care-prep-notes">{item.prep_notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Today's ad-hoc fluid therapies */}
      {visibleTodayFluids.length > 0 && (
        <div className="daily-care-section">
          <h3 className="daily-care-section-title">
            <IconDroplet size={16} aria-hidden="true" />
            <span>{pl ? "Płynoterapia / kroplówki z dziś" : "Fluid therapy today"}</span>
          </h3>
          <ul className="daily-care-visit-list">
            {visibleTodayFluids.map((f) => {
              const routeLabel =
                f.route === "sc"
                  ? pl ? "podskórnie (SC)" : "subcutaneous (SC)"
                  : f.route === "iv"
                    ? pl ? "dożylnie (IV)" : "intravenous (IV)"
                    : f.route;
              const timePart = f.administered_at
                ? new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Warsaw",
                  }).format(new Date(f.administered_at))
                : "";
              const locLabel =
                f.location === "home"
                  ? pl ? "w domu" : "at home"
                  : f.clinic_name
                    ? `${pl ? "klinika: " : "clinic: "}${f.clinic_name}`
                    : pl ? "w lecznicy" : "at clinic";

              return (
                <li key={f.id} className="daily-care-visit-item is-fluid">
                  <IconDroplet size={18} aria-hidden="true" />
                  <div>
                    <strong>
                      {timePart ? `${timePart} · ` : ""}
                      {f.fluid_name} — {f.volume_ml} ml ({routeLabel})
                    </strong>
                    <small>
                      {locLabel}
                      {f.medications_added ? ` · Dodatki: ${f.medications_added}` : ""}
                      {f.catheter_status ? ` · Wenflon: ${f.catheter_status}` : ""}
                    </small>
                    {f.notes && <p className="daily-care-prep-notes">{f.notes}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 4. Today's recorded vitals if any were already logged */}
      {(todayBP || todayGlucose || todayTemp || todayWeights[0]) && (
        <div className="daily-care-vitals-strip">
          <span className="daily-care-vitals-title">
            {pl ? "Zarejestrowane dzisiaj:" : "Recorded today:"}
          </span>
          <div className="daily-care-vitals-chips">
            {todayBP && (
              <span className="daily-care-chip is-recorded">
                <IconHeartRateMonitor size={14} aria-hidden="true" />
                <span>
                  {Math.round(Number(todayBP.value_primary))}
                  {todayBP.value_secondary
                    ? `/${Math.round(Number(todayBP.value_secondary))}`
                    : ""}{" "}
                  mmHg
                </span>
              </span>
            )}
            {todayGlucose && (
              <span className="daily-care-chip is-recorded">
                <IconDroplet size={14} aria-hidden="true" />
                <span>{Math.round(Number(todayGlucose.value_primary))} mg/dL</span>
              </span>
            )}
            {todayTemp && (
              <span className="daily-care-chip is-recorded">
                <IconTemperature size={14} aria-hidden="true" />
                <span>{Number(todayTemp.value_primary).toFixed(1)} °C</span>
              </span>
            )}
            {todayWeights[0] && (
              <span className="daily-care-chip is-recorded">
                <IconScale size={14} aria-hidden="true" />
                <span>{Number(todayWeights[0].kg).toFixed(2)} kg</span>
              </span>
            )}
          </div>
        </div>
      )}

      {skippingDose && (
        <SkipDoseDialog
          dose={skippingDose}
          petName={petName}
          onClose={() => setSkippingDose(null)}
          onConfirm={async (notes) => {
            const dose = skippingDose;
            setSkippingDose(null);
            await handleToggleDose(dose, "skipped", notes);
          }}
        />
      )}
    </section>
  );
}
