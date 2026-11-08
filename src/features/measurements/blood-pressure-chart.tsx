"use client";
import { useId } from "react";
import type { VitalMeasurement } from "./types";

export function BloodPressureChart({
  rows,
  locale,
}: {
  rows: VitalMeasurement[];
  locale: string;
}) {
  const gradId = useId();
  if (rows.length === 0) return null;

  // Chronologicznie od najstarszych do najnowszych na osi X
  const sorted = [...rows].sort(
    (a, b) =>
      a.measured_on.localeCompare(b.measured_on) ||
      a.measured_at.localeCompare(b.measured_at)
  );

  const sapValues = sorted.map((r) => r.value_primary);
  const dapValues = sorted
    .map((r) => r.value_secondary)
    .filter((v): v is number => typeof v === "number" && v > 0);

  const minVal = Math.min(...(dapValues.length ? dapValues : sapValues), 80);
  const maxVal = Math.max(...sapValues, 190);

  const low = Math.floor(Math.max(40, minVal - 15) / 10) * 10;
  const high = Math.ceil(Math.min(260, maxVal + 15) / 10) * 10;
  const range = high - low || 1;

  const width = 720;
  const height = 230;
  const padLeft = 65;
  const padRight = 35;
  const padTop = 30;
  const padBottom = 35;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const firstTime = new Date(sorted[0].measured_on).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].measured_on).getTime();
  const timeSpan = lastTime - firstTime;

  const points = sorted.map((r, i) => {
    const t = new Date(r.measured_on).getTime();
    const x =
      timeSpan === 0
        ? padLeft + chartW / 2
        : padLeft + ((t - firstTime) / timeSpan) * chartW;
    const ySap = padTop + chartH - ((r.value_primary - low) / range) * chartH;
    const yDap =
      r.value_secondary != null
        ? padTop + chartH - ((r.value_secondary - low) / range) * chartH
        : null;

    return { row: r, x, ySap, yDap, i };
  });

  const sapLine = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.ySap.toFixed(1)}`).join(" ");
  const dapPoints = points.filter((p) => p.yDap != null);
  const dapLine = dapPoints.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.yDap!.toFixed(1)}`).join(" ");

  // Poziome linie referencyjne IRIS/ACVIM: 140 (norma), 160 (nadciśnienie), 180 (ciężkie)
  const refLevels = [
    { val: 140, label: "Norma (<140)", stroke: "rgba(16, 185, 129, 0.4)", textFill: "#059669" },
    { val: 160, label: "Nadciśnienie (160)", stroke: "rgba(245, 158, 11, 0.4)", textFill: "#d97706" },
    { val: 180, label: "Ciężkie (180)", stroke: "rgba(239, 68, 68, 0.45)", textFill: "#dc2626" },
  ].filter((l) => l.val >= low && l.val <= high);

  return (
    <figure className="weight-chart bp-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Wykres ciśnienia tętniczego"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Linie referencyjne ACVIM/IRIS */}
        {refLevels.map((lvl) => {
          const y = padTop + chartH - ((lvl.val - low) / range) * chartH;
          return (
            <g key={lvl.val} className="bp-ref-line">
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke={lvl.stroke}
                strokeDasharray="4 3"
                strokeWidth="1.5"
              />
              <text
                x={width - padRight + 4}
                y={y + 3}
                fontSize="9"
                fill={lvl.textFill}
                fontWeight="500"
              >
                {lvl.val}
              </text>
            </g>
          );
        })}

        {/* Siatka pozioma osi Y */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const val = Math.round(low + range * f);
          const y = padTop + chartH - f * chartH;
          return (
            <g key={f}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Cień pod krzywą SAP */}
        {points.length > 1 && (
          <path
            d={`${sapLine} L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`}
            fill={`url(#${gradId})`}
          />
        )}

        {/* Linia DAP (rozkurczowe) */}
        {dapPoints.length > 1 && (
          <path
            d={dapLine}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* Linia SAP (skurczowe) */}
        <path d={sapLine} fill="none" stroke="#0f766e" strokeWidth="2.5" />

        {/* Punkty pomiarowe */}
        {points.map((p) => {
          const hasDap = p.yDap != null;
          const displayLabel = hasDap
            ? `${Math.round(p.row.value_primary)}/${Math.round(p.row.value_secondary!)}`
            : `${Math.round(p.row.value_primary)}`;

          return (
            <g key={p.row.id} className="bp-point-group">
              {/* Punkt DAP */}
              {hasDap && (
                <circle
                  cx={p.x}
                  cy={p.yDap!}
                  r="4"
                  fill="#ffffff"
                  stroke="#0284c7"
                  strokeWidth="2"
                />
              )}
              {/* Punkt SAP */}
              <circle
                cx={p.x}
                cy={p.ySap}
                r="5"
                fill="#ffffff"
                stroke="#0f766e"
                strokeWidth="2.5"
              />
              <title>{`${p.row.measured_on}: ${displayLabel} mmHg ${p.row.value_tertiary ? `(HR: ${p.row.value_tertiary} bpm)` : ""}`}</title>

              {/* Dymek z wartością */}
              {(sorted.length <= 6 || p.i === 0 || p.i === sorted.length - 1) && (
                <>
                  <rect
                    x={p.x - 30}
                    y={p.ySap - 24}
                    width="60"
                    height="18"
                    rx="4"
                    fill="#0f766e"
                  />
                  <text
                    x={p.x}
                    y={p.ySap - 12}
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="middle"
                    fill="#ffffff"
                  >
                    {displayLabel}
                  </text>
                  <text
                    x={p.x}
                    y={height - 12}
                    fontSize="10"
                    textAnchor="middle"
                    fill="#64748b"
                  >
                    {new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(new Date(p.row.measured_on))}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="bp-chart-legend">
        <span className="bp-legend-item">
          <span className="bp-legend-dot bp-dot-sap" />
          <span>Skurczowe (SAP)</span>
        </span>
        {dapValues.length > 0 && (
          <span className="bp-legend-item">
            <span className="bp-legend-dot bp-dot-dap" />
            <span>Rozkurczowe (DAP)</span>
          </span>
        )}
      </div>
    </figure>
  );
}
