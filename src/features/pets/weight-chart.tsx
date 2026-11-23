import { useTranslations } from "next-intl";
import { useFormatters } from "@/lib/formatters";
import type { PetProfile } from "./types";

export function WeightChart({
  measurements,
}: {
  measurements: PetProfile["weights"];
}) {
  const t = useTranslations("copy");
  const { formatDate, formatNumber } = useFormatters();
  if (!measurements.length) return <p>{t("noWeightMeasurements")}</p>;
  const min = Math.min(...measurements.map((item) => item.kg)) - 0.1;
  const max = Math.max(...measurements.map((item) => item.kg)) + 0.1;
  const points = measurements.map((item, index) => ({
    x: 10 + (index * 180) / Math.max(measurements.length - 1, 1),
    y: 38 - ((item.kg - min) / (max - min)) * 30,
  }));
  return (
    <figure className="weight-chart">
      <svg
        viewBox="0 0 200 48"
        role="img"
        aria-label={measurements
          .map(
            (item) => `${formatDate(item.date)}: ${formatNumber(item.kg)} kg`,
          )
          .join("; ")}
      >
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
        {points.map((p, index) => (
          <circle
            key={measurements[index].date}
            cx={p.x}
            cy={p.y}
            r={index === points.length - 1 ? 4 : 3}
          />
        ))}
      </svg>
      <figcaption className="caption">
        {t("latestMeasurements")}{" "}
        {measurements.map((item) => `${formatNumber(item.kg)} kg`).join(" → ")}
      </figcaption>
    </figure>
  );
}
