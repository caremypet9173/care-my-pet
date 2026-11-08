"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconHeartRateMonitor,
  IconPencil,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import { BloodPressureChart } from "./blood-pressure-chart";
import { BloodPressureDialog } from "./blood-pressure-dialog";
import { VitalDeleteDialog } from "./vital-delete-dialog";
import { deleteVitalMeasurement } from "./actions";
import {
  getBloodPressureStage,
  type VitalMeasurement,
} from "./types";

const CONTEXT_LABELS: Record<string, { pl: string; en: string }> = {
  vet_calm: { pl: "W gabinecie – spokojny", en: "In clinic – calm" },
  vet_stress: { pl: "W gabinecie – stres", en: "In clinic – stressed" },
  home: { pl: "Pomiar domowy", en: "Home measurement" },
  doppler: { pl: "Doppler weterynaryjny", en: "Doppler" },
  oscillometric: { pl: "Oscylometria (HDO)", en: "Oscillometric (HDO)" },
  other: { pl: "Inne", en: "Other" },
};

export function BloodPressureView({
  petId,
  petName,
  initialRows,
}: {
  petId: string;
  petName: string;
  initialRows: VitalMeasurement[];
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<VitalMeasurement | null | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<VitalMeasurement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const latest = rows[0];
  const previous = rows[1];

  const formatDate = (s: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(s));

  async function handleDelete(target: VitalMeasurement) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await deleteVitalMeasurement({
        id: target.id,
        petId,
        revision: target.revision,
      });

      if (res.error) {
        setDeleteError(
          res.isConflict
            ? pl
              ? "Pomiar został zmieniony lub usunięty. Odśwież stronę."
              : "Measurement changed or deleted. Please refresh."
            : pl
              ? "Nie udało się usunąć pomiaru. Spróbuj ponownie."
              : "Failed to delete measurement. Please retry."
        );
        return;
      }

      setRows((cur) => cur.filter((r) => r.id !== target.id));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError(
        pl
          ? "Nie udało się usunąć pomiaru. Spróbuj ponownie."
          : "Failed to delete measurement. Please retry."
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleSave(row: VitalMeasurement) {
    setRows((current) =>
      [...current.filter((r) => r.id !== row.id), row].sort(
        (a, b) =>
          b.measured_on.localeCompare(a.measured_on) ||
          b.measured_at.localeCompare(a.measured_at)
      )
    );
    setEditing(undefined);
    router.refresh();
  }

  const latestStage = latest ? getBloodPressureStage(latest.value_primary) : null;

  return (
    <div className="vital-metric-view">
      {/* 1. Karta ostatniego pomiaru */}
      <section className="weight-card weight-metric">
        <header>
          <div>
            <small>{pl ? "PARAMETRY ŻYCIOWE" : "VITAL SIGNS"}</small>
            <h2>{pl ? "Ciśnienie tętnicze krwi" : "Blood pressure"}</h2>
            <p>
              {pl
                ? "Pomiary ciśnienia skurczowego (SAP), rozkurczowego (DAP) oraz tętna."
                : "Systolic (SAP), diastolic (DAP) and heart rate monitoring."}
            </p>
          </div>
          <button
            type="button"
            className="weight-primary"
            onClick={() => setEditing(null)}
          >
            <IconPlus size={16} />
            {pl ? "Dodaj pomiar ciśnienia" : "Add blood pressure"}
          </button>
        </header>

        {latest ? (
          <div className="weight-metric-body">
            <div>
              <div className="vital-metric-card-values">
                <strong>
                  {Math.round(latest.value_primary)}
                  {latest.value_secondary ? ` / ${Math.round(latest.value_secondary)}` : ""}
                  <span>mmHg</span>
                </strong>
                {latest.value_tertiary && (
                  <span className="vital-metric-hr-tag">
                    HR: <strong>{Math.round(latest.value_tertiary)}</strong> bpm
                  </span>
                )}
                {latestStage && (
                  <span className={`vital-status-pill ${latestStage.colorClass}`}>
                    {pl ? latestStage.labelPl : latestStage.labelEn}
                  </span>
                )}
              </div>
              <p>
                {formatDate(latest.measured_on)}
                {latest.context && CONTEXT_LABELS[latest.context]
                  ? ` · ${pl ? CONTEXT_LABELS[latest.context].pl : CONTEXT_LABELS[latest.context].en}`
                  : ""}
              </p>
            </div>

            <div>
              {previous && (
                <span className="weight-change">
                  {latest.value_primary > previous.value_primary ? "+" : ""}
                  {Math.round(latest.value_primary - previous.value_primary)} mmHg{" "}
                  {pl
                    ? "względem poprzedniego pomiaru"
                    : "since previous reading"}{" "}
                  ({formatDate(previous.measured_on)}:{" "}
                  {Math.round(previous.value_primary)}
                  {previous.value_secondary ? `/${Math.round(previous.value_secondary)}` : ""}{" "}
                  mmHg)
                </span>
              )}
              <a href="#bp-history">
                {pl ? "Historia pomiarów" : "Measurement history"} →
              </a>
            </div>
          </div>
        ) : (
          <div className="weight-empty">
            <IconHeartRateMonitor size={36} />
            <h3>
              {pl
                ? "Nie zarejestrowano jeszcze pomiarów ciśnienia"
                : "No blood pressure records yet"}
            </h3>
            <p>
              {pl
                ? "Dodaj pierwszy pomiar ciśnienia, aby rozpocząć monitorowanie układu krążenia pupila."
                : "Add the first blood pressure measurement to begin cardiovascular monitoring."}
            </p>
            <button type="button" onClick={() => setEditing(null)}>
              {pl ? "Dodaj pierwszy pomiar" : "Add first measurement"}
            </button>
          </div>
        )}
      </section>

      {/* 2. Wykres trendu */}
      <section className="weight-card">
        <header>
          <div>
            <h3>{pl ? "Trend ciśnienia tętniczego" : "Blood pressure trend"}</h3>
            <p>
              {pl
                ? "Historia pomiarów skurczowych i rozkurczowych w mmHg"
                : "Recent systolic and diastolic records in mmHg"}
            </p>
          </div>
        </header>

        {rows.length >= 2 ? (
          <BloodPressureChart rows={rows.slice(0, 15)} locale={locale} />
        ) : (
          <p className="weight-chart-empty">
            {pl
              ? "Wykres pojawi się po dodaniu co najmniej 2 pomiarów ciśnienia."
              : "Chart will appear after recording at least 2 measurements."}
          </p>
        )}

        <div className="weight-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Zgodnie z wytycznymi ACVIM ciśnienie skurczowe (SAP) poniżej 140 mmHg oznacza minimalne ryzyko powikłań. Wartości stale przekraczające 160 mmHg wymagają diagnostyki (np. pod kątem chorób nerek lub tarczycy)."
              : "ACVIM guidelines state systolic pressure below 140 mmHg has minimal risk. Readings above 160 mmHg warrant veterinary investigation."}
          </p>
        </div>
      </section>

      {/* 3. Tabela pomiarów */}
      <section className="weight-card" id="bp-history">
        <header>
          <h3>
            {pl
              ? "Tabela ostatnich pomiarów ciśnienia"
              : "Blood pressure history table"}
          </h3>
          <span>
            {rows.length} {pl ? "pomiarów" : "records"}
          </span>
        </header>

        {rows.length > 0 ? (
          <div className="weight-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    pl ? "Data pomiaru" : "Date",
                    pl ? "Ciśnienie (SAP/DAP)" : "Blood pressure",
                    pl ? "Tętno (HR)" : "Heart rate",
                    pl ? "Klasyfikacja IRIS" : "Classification",
                    pl ? "Okoliczności / metoda" : "Context",
                    pl ? "Notatka" : "Note",
                    pl ? "Akcje" : "Actions",
                  ].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const stage = getBloodPressureStage(row.value_primary);
                  const ctx = CONTEXT_LABELS[row.context];

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.measured_on)}</td>
                      <td>
                        <strong>
                          {Math.round(row.value_primary)}
                          {row.value_secondary
                            ? ` / ${Math.round(row.value_secondary)}`
                            : ""}{" "}
                          mmHg
                        </strong>
                      </td>
                      <td>
                        {row.value_tertiary
                          ? `${Math.round(row.value_tertiary)} bpm`
                          : "—"}
                      </td>
                      <td>
                        <span className={`vital-status-pill ${stage.colorClass}`}>
                          {pl ? stage.labelPl : stage.labelEn}
                        </span>
                      </td>
                      <td>
                        {ctx ? (
                          <span className="vital-context-tag">
                            {pl ? ctx.pl : ctx.en}
                          </span>
                        ) : (
                          row.context || "—"
                        )}
                      </td>
                      <td>{row.note || "—"}</td>
                      <td>
                        <div className="weight-row-actions">
                          <button
                            type="button"
                            className="weight-edit"
                            onClick={() => setEditing(row)}
                            aria-label={`${pl ? "Edytuj pomiar" : "Edit"} ${formatDate(row.measured_on)}`}
                          >
                            <IconPencil size={15} aria-hidden="true" />
                            {pl ? "Edytuj" : "Edit"}
                          </button>
                          <button
                            type="button"
                            className="weight-edit weight-delete"
                            disabled={deleting}
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(row);
                            }}
                            aria-label={`${pl ? "Usuń pomiar" : "Delete"} ${formatDate(row.measured_on)}`}
                          >
                            <IconTrash size={15} aria-hidden="true" />
                            {pl ? "Usuń" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{pl ? "Nie zapisano jeszcze pomiarów." : "No records saved yet."}</p>
        )}
      </section>

      {/* Dialog edycji/dodawania */}
      {editing !== undefined && (
        <BloodPressureDialog
          petId={petId}
          petName={petName}
          measurement={editing}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
        />
      )}

      {/* Dialog usuwania */}
      {deleteTarget && (
        <VitalDeleteDialog
          title={`${petName} — ${pl ? "Pomiar ciśnienia" : "Blood pressure"}`}
          detail={`${Math.round(deleteTarget.value_primary)}${deleteTarget.value_secondary ? `/${Math.round(deleteTarget.value_secondary)}` : ""} mmHg`}
          date={formatDate(deleteTarget.measured_on)}
          pending={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
