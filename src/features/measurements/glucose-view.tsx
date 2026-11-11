"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconDroplet,
  IconPencil,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import { GlucoseChart } from "./glucose-chart";
import { GlucoseDialog } from "./glucose-dialog";
import { VitalDeleteDialog } from "./vital-delete-dialog";
import { deleteVitalMeasurement } from "./actions";
import {
  getGlucoseStatus,
  type VitalMeasurement,
} from "./types";

const CONTEXT_LABELS: Record<string, { pl: string; en: string }> = {
  fasting: { pl: "Na czczo", en: "Fasting" },
  postprandial: { pl: "Po posiłku", en: "Postprandial" },
  random: { pl: "Losowy pomiar", en: "Random" },
  pre_insulin: { pl: "Przed insuliną", en: "Pre-insulin" },
  post_insulin: { pl: "Po insulinie", en: "Post-insulin" },
  clinic: { pl: "W gabinecie", en: "Clinic" },
};

export function GlucoseView({
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

  const latestStatus = latest ? getGlucoseStatus(latest.value_primary) : null;

  return (
    <div className="vital-metric-view">
      {/* 1. Karta ostatniego pomiaru */}
      <section className="weight-card weight-metric">
        <header>
          <div>
            <small>{pl ? "PARAMETRY ŻYCIOWE" : "VITAL SIGNS"}</small>
            <h2>{pl ? "Poziom glukozy (Glikemia)" : "Blood glucose"}</h2>
            <p>
              {pl
                ? "Bieżące stężenie cukru we krwi i profil glikemiczny pupila."
                : "Blood glucose monitoring and glycemic profile."}
            </p>
          </div>
          <button
            type="button"
            className="weight-primary"
            onClick={() => setEditing(null)}
          >
            <IconPlus size={16} />
            {pl ? "Dodaj pomiar glukozy" : "Add glucose reading"}
          </button>
        </header>

        {latest ? (
          <div className="weight-metric-body">
            <div>
              <div className="vital-metric-card-values">
                <strong>
                  {Math.round(latest.value_primary)}
                  <span>mg/dL</span>
                </strong>
                <span className="vital-metric-hr-tag">
                  ≈ {(latest.value_primary / 18.0182).toFixed(1)} mmol/L
                </span>
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
                  {Math.round(latest.value_primary - previous.value_primary)} mg/dL{" "}
                  {pl
                    ? "względem poprzedniego pomiaru"
                    : "since previous reading"}{" "}
                  ({formatDate(previous.measured_on)}:{" "}
                  {Math.round(previous.value_primary)} mg/dL)
                </span>
              )}
              <a href="#glucose-history">
                {pl ? "Historia pomiarów" : "Measurement history"} →
              </a>
            </div>
          </div>
        ) : (
          <div className="weight-empty">
            <IconDroplet size={36} />
            <h3>
              {pl
                ? "Nie zarejestrowano jeszcze pomiarów glukozy"
                : "No glucose records yet"}
            </h3>
            <p>
              {pl
                ? "Dodaj pierwszy pomiar cukru, aby rozpocząć monitorowanie glikemii i profilaktyki cukrzycy."
                : "Add the first glucose reading to track diabetes care or glycemic control."}
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
            <h3>{pl ? "Trend stężenia glukozy" : "Blood glucose trend"}</h3>
            <p>
              {pl
                ? "Ostatnie pomiary • wartości w mg/dL"
                : "Recent measurements • values in mg/dL"}
            </p>
          </div>
        </header>

        {rows.length >= 2 ? (
          <GlucoseChart rows={rows.slice(0, 15)} locale={locale} />
        ) : (
          <p className="weight-chart-empty">
            {pl
              ? "Wykres pojawi się po dodaniu co najmniej 2 pomiarów glukozy."
              : "Chart will appear after recording at least 2 measurements."}
          </p>
        )}

        <div className="weight-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Prawidłowe stężenie glukozy u psów i kotów na czczo mieści się w granicach 70–150 mg/dL. Wyniki poniżej 70 mg/dL sygnalizują niebezpieczną hipoglikemię."
              : "Fasting glucose in healthy pets is typically 70–150 mg/dL. Values below 70 mg/dL require immediate attention."}
          </p>
        </div>
      </section>

      {/* 3. Tabela pomiarów */}
      <section className="weight-card" id="glucose-history">
        <header>
          <h3>
            {pl
              ? "Tabela ostatnich pomiarów glukozy"
              : "Blood glucose history table"}
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
                    pl ? "Stężenie glukozy" : "Glucose",
                    pl ? "mmol/L" : "mmol/L",
                    pl ? "Status" : "Status",
                    pl ? "Okoliczności" : "Context",
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
                  const status = getGlucoseStatus(row.value_primary);
                  const ctx = CONTEXT_LABELS[row.context];

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.measured_on)}</td>
                      <td>
                        <strong>{Math.round(row.value_primary)} mg/dL</strong>
                      </td>
                      <td>
                        {(row.value_primary / 18.0182).toFixed(1)} mmol/L
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
        <GlucoseDialog
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
          title={`${petName} — ${pl ? "Pomiar glukozy" : "Blood glucose"}`}
          detail={`${Math.round(deleteTarget.value_primary)} mg/dL (${(deleteTarget.value_primary / 18.0182).toFixed(1)} mmol/L)`}
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
