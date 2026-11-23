"use client";
import { useId } from "react";
import type { VitalMeasurement } from "./types";

export function GlucoseChart({
  rows,
  locale,
}: {
  rows: VitalMeasurement[];
  locale: string;
}) {
  const gradId = useId();
  if (rows.length === 0) return null;

  const sorted = [...rows].sort(
    (a, b) =>
      a.measured_on.localeCompare(b.measured_on) ||
      a.measured_at.localeCompare(b.measured_at)
  );

  const values = sorted.map((r) => r.value_primary);
  const minVal = Math.min(...values, 60);
  const maxVal = Math.max(...values, 200);

  const low = Math.floor(Math.max(20, minVal - 15) / 10) * 10;
  const high = Math.ceil(Math.min(500, maxVal + 20) / 10) * 10;
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
    const y = padTop + chartH - ((r.value_primary - low) / range) * chartH;
    return { row: r, x, y, i };
  });

  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Strefa normy: 70 - 150 mg/dL
  const yNormTop = Math.max(padTop, padTop + chartH - ((150 - low) / range) * chartH);
  const yNormBottom = Math.min(padTop + chartH, padTop + chartH - ((70 - low) / range) * chartH);
  const normBandHeight = Math.max(0, yNormBottom - yNormTop);

  return (
    <figure className="weight-chart glucose-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Wykres glikemii"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Zielone pasmo referencyjne fizjologiczne 70-150 mg/dL */}
        {normBandHeight > 0 && (
          <rect
            x={padLeft}
            y={yNormTop}
            width={chartW}
            height={normBandHeight}
            fill="rgba(16, 185, 129, 0.08)"
            stroke="rgba(16, 185, 129, 0.25)"
            strokeDasharray="3 3"
          />
        )}

        {/* Etykieta strefy normy */}
        <text
          x={padLeft + 8}
          y={yNormTop + 14}
          fontSize="9.5"
          fill="#059669"
          fontWeight="500"
        >
          Norma: 70–150 mg/dL
        </text>

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

        {/* Cień pod krzywą */}
        {points.length > 1 && (
          <path
            d={`${line} L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`}
            fill={`url(#${gradId})`}
          />
        )}

        {/* Linia główna */}
        <path d={line} fill="none" stroke="#8b5cf6" strokeWidth="2.5" />

        {/* Punkty pomiarowe */}
        {points.map((p) => {
          const isHypo = p.row.value_primary < 70;
          const isHyper = p.row.value_primary > 180;
          const pointColor = isHypo ? "#ef4444" : isHyper ? "#f59e0b" : "#8b5cf6";

          return (
            <g key={p.row.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHypo || isHyper ? 5.5 : 4.5}
                fill="#ffffff"
                stroke={pointColor}
                strokeWidth={2.5}
              />
              <title>{`${p.row.measured_on}: ${p.row.value_primary} mg/dL (${(p.row.value_primary / 18.018).toFixed(1)} mmol/L)`}</title>

              {(sorted.length <= 6 || p.i === 0 || p.i === sorted.length - 1) && (
                <>
                  <rect
                    x={p.x - 28}
                    y={p.y - 23}
                    width="56"
                    height="18"
                    rx="4"
                    fill={pointColor}
                  />
                  <text
                    x={p.x}
                    y={p.y - 11}
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="middle"
                    fill="#ffffff"
                  >
                    {Math.round(p.row.value_primary)}
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
      <div className="glucose-chart-legend">
        <span className="glucose-legend-item">
          <span className="glucose-legend-band" />
          <span>Fizjologiczny zakres normy (70–150 mg/dL)</span>
        </span>
      </div>
    </figure>
  );
}
