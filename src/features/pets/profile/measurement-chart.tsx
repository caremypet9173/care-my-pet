import { useTranslations } from "next-intl";
import { useId } from "react";
import { useFormatters } from "@/lib/formatters";
export function MeasurementChart({
  label,
  unit,
  points,
}: {
  label: string;
  unit: string;
  points: readonly { date: string; value: number }[];
}) {
  const t = useTranslations("copy");
  const { formatDate, formatNumber } = useFormatters();
  const id = useId().replaceAll(":", "");
  if (!points.length) return <p>{t("noMeasurements")}</p>;
  const min = Math.min(...points.map((item) => item.value)) - 0.15;
  const max = Math.max(...points.map((item) => item.value)) + 0.15;
  const coordinates = points.map((item, index) => ({
    ...item,
    x: 35 + (index * 250) / Math.max(points.length - 1, 1),
    y: 105 - ((item.value - min) / (max - min)) * 80,
  }));
  const line = coordinates
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  return (
    <figure className="measurement-chart">
      <svg
        viewBox="0 0 320 135"
        role="img"
        aria-label={`${label}: ${points.map((item) => `${formatDate(item.date)}, ${formatNumber(item.value)} ${unit}`).join("; ")}`}
      >
        <defs>
          <linearGradient id={`gradient-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path
          d={`${line} L ${coordinates.at(-1)!.x} 110 L 35 110 Z`}
          fill={`url(#gradient-${id})`}
        />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {coordinates.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" fill="currentColor" />
            <text x={point.x} y={point.y - 12} textAnchor="middle">
              {formatNumber(point.value)}
            </text>
            <text
              className="chart-date"
              x={point.x}
              y="130"
              textAnchor="middle"
            >
              {point.date.slice(5, 7)}.{point.date.slice(0, 4)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="caption">
        {label} · {unit}
      </figcaption>
    </figure>
  );
}
