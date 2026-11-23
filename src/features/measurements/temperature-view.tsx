"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconTemperature,
  IconPencil,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import { TemperatureChart } from "./temperature-chart";
import { TemperatureDialog } from "./temperature-dialog";
import { VitalDeleteDialog } from "./vital-delete-dialog";
import { deleteVitalMeasurement } from "./actions";
import {
  getTemperatureStatus,
  type VitalMeasurement,
} from "./types";

const CONTEXT_LABELS: Record<string, { pl: string; en: string }> = {
  rectal: { pl: "Rektalny (standard)", en: "Rectal (standard)" },
  ear: { pl: "Douszny", en: "Ear" },
  axillary: { pl: "W pachwinie", en: "Axillary" },
  resting: { pl: "W spoczynku", en: "Resting" },
  after_effort: { pl: "Po wysiłku", en: "After exercise" },
  clinic: { pl: "W gabinecie", en: "Clinic" },
};

export function TemperatureView({
  petId,
  petName,
  initialRows,
  readOnly = false,
}: {
  petId: string;
  petName: string;
  initialRows: VitalMeasurement[];
  readOnly?: boolean;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [prevInitialRows, setPrevInitialRows] = useState(initialRows);
  const [rows, setRows] = useState(initialRows);
  if (initialRows !== prevInitialRows) {
    setPrevInitialRows(initialRows);
    setRows(initialRows);
  }
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

  const latestStatus = latest ? getTemperatureStatus(latest.value_primary) : null;

  return (
    <div className="vital-metric-view">
      {/* 1. Karta ostatniego pomiaru */}
      <section className="weight-card weight-metric">
        <header>
          <div>
            <small>{pl ? "PARAMETRY ŻYCIOWE" : "VITAL SIGNS"}</small>
            <h2>{pl ? "Ciepłota ciała (Temperatura)" : "Body temperature"}</h2>
            <p>
              {pl
                ? "Bieżące pomiary i historia temperatury ciała pupila."
                : "Body temperature tracking and fever alerts."}
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="weight-primary"
              onClick={() => setEditing(null)}
            >
              <IconPlus size={16} />
              {pl ? "Dodaj pomiar temperatury" : "Add temperature"}
            </button>
          )}
        </header>

        {latest ? (
          <div className="weight-metric-body">
            <div>
              <div className="vital-metric-card-values">
                <strong>
                  {latest.value_primary.toFixed(1)}
                  <span>°C</span>
                </strong>
                {latestStatus && (
                  <span className={`vital-status-pill ${latestStatus.colorClass}`}>
                    {pl ? latestStatus.labelPl : latestStatus.labelEn}
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
                  {(latest.value_primary - previous.value_primary).toFixed(1)} °C{" "}
                  {pl
                    ? "względem poprzedniego pomiaru"
                    : "since previous reading"}{" "}
                  ({formatDate(previous.measured_on)}:{" "}
                  {previous.value_primary.toFixed(1)} °C)
                </span>
              )}
              <a href="#temp-history">
                {pl ? "Historia pomiarów" : "Measurement history"} →
              </a>
            </div>
          </div>
        ) : (
          <div className="weight-empty">
            <IconTemperature size={36} />
            <h3>
              {pl
                ? "Nie zarejestrowano jeszcze temperatury"
                : "No temperature records yet"}
            </h3>
            <p>
              {pl
                ? "Dodaj pierwszy pomiar temperatury, aby rozpocząć monitorowanie stanu zdrowia pupila."
                : "Add the first temperature record to start monitoring pet vitals."}
            </p>
            {!readOnly && (
              <button type="button" onClick={() => setEditing(null)}>
                {pl ? "Dodaj pierwszy pomiar" : "Add first measurement"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. Wykres trendu */}
      <section className="weight-card">
        <header>
          <div>
            <h3>{pl ? "Trend temperatury ciała" : "Temperature trend"}</h3>
            <p>
              {pl
                ? "Ostatnie pomiary • wartości w °C"
                : "Recent measurements • values in °C"}
            </p>
          </div>
        </header>

        {rows.length >= 2 ? (
          <TemperatureChart rows={rows.slice(0, 15)} locale={locale} />
        ) : (
          <p className="weight-chart-empty">
            {pl
              ? "Wykres pojawi się po dodaniu co najmniej 2 pomiarów temperatury."
              : "Chart will appear after recording at least 2 measurements."}
          </p>
        )}

        <div className="weight-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Prawidłowa temperatura fizjologiczna psów i kotów to 37.5–39.0°C. Temperatura przekraczająca 39.5°C kwalifikowana jest jako gorączka."
              : "Normal canine and feline body temperature is 37.5–39.0°C. Temperature ≥ 39.5°C indicates fever."}
          </p>
        </div>
      </section>

      {/* 3. Tabela pomiarów */}
      <section className="weight-card" id="temp-history">
        <header>
          <h3>
            {pl
              ? "Tabela ostatnich pomiarów temperatury"
              : "Temperature history table"}
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
                    pl ? "Temperatura" : "Temperature",
                    pl ? "Ocena kliniczna" : "Clinical status",
                    pl ? "Miejsce / metoda" : "Location",
                    pl ? "Notatka" : "Note",
                    ...(readOnly ? [] : [pl ? "Akcje" : "Actions"]),
                  ].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = getTemperatureStatus(row.value_primary);
                  const ctx = CONTEXT_LABELS[row.context];

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.measured_on)}</td>
                      <td>
                        <strong>{row.value_primary.toFixed(1)} °C</strong>
                      </td>
                      <td>
                        <span className={`vital-status-pill ${status.colorClass}`}>
                          {pl ? status.labelPl : status.labelEn}
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
                      {!readOnly && (
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
                      )}
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
        <TemperatureDialog
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
          title={`${petName} — ${pl ? "Pomiar temperatury" : "Body temperature"}`}
          detail={`${deleteTarget.value_primary.toFixed(1)} °C`}
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
