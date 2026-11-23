"use client";
import { useState, useId } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconScale,
  IconPencil,
  IconTrash,
  IconInfoCircle,
} from "@tabler/icons-react";
import { WeightDialog } from "@/features/weight/weight-dialog";
import { WeightDeleteDialog } from "@/features/weight/weight-delete-dialog";
import { createClient } from "@/lib/supabase/client";
import type { WeightMeasurement } from "@/features/weight/types";

export function WeightView({
  petId,
  petName,
  measurements,
  readOnly = false,
}: {
  petId: string;
  petName: string;
  measurements: WeightMeasurement[];
  readOnly?: boolean;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [prevMeasurements, setPrevMeasurements] = useState(measurements);
  const [rows, setRows] = useState(measurements);
  if (measurements !== prevMeasurements) {
    setPrevMeasurements(measurements);
    setRows(measurements);
  }
  const [editing, setEditing] = useState<WeightMeasurement | null | undefined>();

  const format = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(n);

  const date = (s: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(s));

  const latest = rows[0];
  const previous = rows[1];
  const change = (a: number, b: number) => `${a > b ? "+" : ""}${format(a - b)} kg`;

  const [deleteTarget, setDeleteTarget] = useState<WeightMeasurement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function remove(row: WeightMeasurement) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { error } = await createClient()
        .functions.invoke("pet-weight", {
          body: { action: "delete", id: row.id, pet_id: petId, revision: row.revision },
        });
      if (error) {
        setDeleteError(
          error.context?.status === 409
            ? pl
              ? "Pomiar zmieniono lub usunięto. Odśwież stronę."
              : "The measurement changed or was deleted. Refresh the page."
            : pl
              ? "Nie udało się usunąć pomiaru. Spróbuj ponownie."
              : "Could not delete the measurement. Please retry."
        );
        return;
      }
      setRows((current) => current.filter((r) => r.id !== row.id));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError(
        pl
          ? "Nie udało się usunąć pomiaru. Spróbuj ponownie."
          : "Could not delete the measurement. Please retry."
      );
    } finally {
      setDeleting(false);
    }
  }

  const add = readOnly ? null : (
    <button
      type="button"
      className="weight-primary"
      onClick={() => setEditing(null)}
    >
      <IconPlus size={16} />
      {pl ? "Dodaj pomiar masy" : "Add weight measurement"}
    </button>
  );

  return (
    <div className="vital-metric-view">
      <section className="weight-card weight-metric">
        <header>
          <div>
            <small>{pl ? "PARAMETRY FIZYCZNE" : "PHYSICAL PARAMETERS"}</small>
            <h2>{pl ? "Masa ciała i kondycja" : "Weight and condition"}</h2>
            <p>
              {pl
                ? "Bieżące pomiary i historia wagi pupila."
                : "Current measurements and weight history."}
            </p>
          </div>
          {add}
        </header>

        {latest ? (
          <div className="weight-metric-body">
            <div>
              <strong>
                {format(latest.kg)} <span>kg</span>
              </strong>
              <p>{date(latest.measured_on)}</p>
            </div>
            <div>
              {previous && (
                <span className="weight-change">
                  {change(latest.kg, previous.kg)}{" "}
                  {pl
                    ? "względem poprzedniego pomiaru"
                    : "since the previous measurement"}{" "}
                  ({date(previous.measured_on)}: {format(previous.kg)} kg)
                </span>
              )}
              <a href="#weight-history">
                {pl ? "Historia pomiarów" : "Measurement history"} →
              </a>
            </div>
          </div>
        ) : (
          <div className="weight-empty">
            <IconScale size={36} />
            <h3>
              {pl
                ? "Nie ma jeszcze pomiarów wagi"
                : "No weight measurements yet"}
            </h3>
            <p>
              {pl
                ? "Dodaj pierwszy pomiar, aby rozpocząć historię wagi."
                : "Add the first measurement to start a weight history."}
            </p>
            {!readOnly && (
              <button type="button" onClick={() => setEditing(null)}>
                {pl ? "Dodaj pierwszy pomiar" : "Add first measurement"}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="weight-card">
        <header>
          <div>
            <h3>{pl ? "Trend masy ciała" : "Weight trend"}</h3>
            <p>{pl ? "Ostatnie pomiary • masa w kg" : "Recent measurements • weight in kg"}</p>
          </div>
        </header>

        {rows.length >= 2 ? (
          <WeightChartSVG rows={rows.slice(0, 15).toReversed()} locale={locale} />
        ) : (
          <p className="weight-chart-empty">
            {pl
              ? "Wykres pojawi się po dodaniu co najmniej 2 pomiarów."
              : "The chart appears after at least 2 measurements."}
          </p>
        )}

        <div className="weight-info">
          <IconInfoCircle size={18} />
          <p>
            {pl
              ? "Zmiana wagi nie jest automatyczną oceną zdrowia. Wyniki rozpatruj w kontekście wieku, aktywności i zaleceń lekarza."
              : "A weight change is not an automatic health assessment. Consider age, activity and veterinary advice."}
          </p>
        </div>
      </section>

      <section className="weight-card" id="weight-history">
        <header>
          <h3>
            {pl
              ? "Tabela ostatnich pomiarów wagi"
              : "Recent weight measurements"}
          </h3>
          <span>
            {rows.length} {pl ? "pomiarów" : "measurements"}
          </span>
        </header>

        {rows.length > 0 ? (
          <div className="weight-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    pl ? "Data pomiaru" : "Date",
                    pl ? "Zarejestrowana masa" : "Weight",
                    pl ? "Różnica" : "Change",
                    pl ? "Okoliczności / wskazówki" : "Notes",
                    ...(readOnly ? [] : [pl ? "Akcje" : "Actions"]),
                  ].map((s) => (
                    <th key={s} scope="col">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id}>
                    <td>{date(row.measured_on)}</td>
                    <td>
                      <strong>{format(row.kg)} kg</strong>
                    </td>
                    <td>
                      {rows[i + 1] ? (
                        <span className="weight-change">
                          {change(row.kg, rows[i + 1].kg)}
                        </span>
                      ) : (
                        "—"
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
                            aria-label={`${pl ? "Edytuj pomiar" : "Edit measurement"} ${date(row.measured_on)}`}
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
                            aria-label={`${pl ? "Usuń pomiar" : "Delete measurement"} ${date(row.measured_on)}`}
                          >
                            <IconTrash size={15} aria-hidden="true" />
                            {pl ? "Usuń" : "Delete"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{pl ? "Nie zapisano jeszcze pomiarów." : "No measurements saved yet."}</p>
        )}
      </section>

      {deleteTarget && (
        <WeightDeleteDialog
          petName={petName}
          weight={format(deleteTarget.kg)}
          date={date(deleteTarget.measured_on)}
          pending={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
          onConfirm={() => remove(deleteTarget)}
        />
      )}

      {editing !== undefined && (
        <WeightDialog
          petId={petId}
          petName={petName}
          measurement={editing}
          onClose={() => setEditing(undefined)}
          onSave={(row) => {
            setRows((current) =>
              [...current.filter((r) => r.id !== row.id), row].sort(
                (a, b) =>
                  b.measured_on.localeCompare(a.measured_on) ||
                  b.created_at.localeCompare(a.created_at)
              )
            );
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function WeightChartSVG({
  rows,
  locale,
}: {
  rows: WeightMeasurement[];
  locale: string;
}) {
  const id = useId();
  const values = rows.map((r) => r.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.3, 0.05);
  const low = Math.max(0, min - pad);
  const high = max + pad;

  const first = Date.parse(rows[0].measured_on);
  const last = Date.parse(rows[rows.length - 1].measured_on);

  const points = rows.map((r) => ({
    row: r,
    x: last === first ? 360 : 70 + ((Date.parse(r.measured_on) - first) / (last - first)) * 580,
    y: 190 - ((r.kg - low) / (high - low)) * 140,
  }));

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n);
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

  return (
    <figure className="weight-chart">
      <svg
        viewBox="0 0 720 235"
        role="img"
        aria-label={rows.map((r) => `${r.measured_on}: ${fmt(r.kg)} kg`).join("; ")}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#123e40" stopOpacity=".25" />
            <stop offset="100%" stopColor="#123e40" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="70"
              x2="650"
              y1={190 - f * 140}
              y2={190 - f * 140}
              stroke="#dfe7e5"
            />
            <text x="60" y={194 - f * 140} textAnchor="end" fontSize="11" fill="#536460">
              {fmt(low + (high - low) * f)}
            </text>
          </g>
        ))}
        <path
          d={`${line} L${points[points.length - 1].x},195 L${points[0].x},195 Z`}
          fill={`url(#${id})`}
        />
        <path d={line} fill="none" stroke="#123e40" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.row.id}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke="#123e40" strokeWidth="2" />
            <title>{`${p.row.measured_on}: ${fmt(p.row.kg)} kg`}</title>
            {(rows.length <= 5 || i === 0 || i === rows.length - 1) && (
              <>
                <rect x={p.x - 28} y={p.y - 28} width="56" height="19" rx="3" fill="#123e40" />
                <text x={p.x} y={p.y - 15} fontSize="10" textAnchor="middle" fill="white">
                  {fmt(p.row.kg)} kg
                </text>
                <text x={p.x} y="220" fontSize="10" textAnchor="middle" fill="#536460">
                  {p.row.measured_on.slice(5)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
