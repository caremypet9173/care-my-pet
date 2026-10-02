"use client";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge, Status } from "@/components/ui/badge";
import { MeasurementChart } from "@/features/pets/profile/measurement-chart";
import { useFormatters } from "@/lib/formatters";
import type { LabReport, LabResult } from "./types";

function getFilters(t: Translator) {
  return [
    { id: "all", label: t("allParameters") },
    { id: "renal", label: t("kidneyProfile") },
    { id: "blood", label: t("bloodCount") },
    { id: "liver", label: t("liverProfile") },
  ] as const;
}
function getCategoryLabels(t: Translator) {
  return {
    renal: t("kidneyProfile"),
    blood: t("bloodCount"),
    liver: t("liverProfile"),
  };
}
function ReferenceRange({ result }: { result: LabResult }) {
  const { formatNumber } = useFormatters();
  const t = useTranslations("copy");
  if (!result.reference) return <span>{t("noRangeProvided")}</span>;
  const { min, max } = result.reference;
  const fraction = Math.max(
    0,
    Math.min(100, 15 + ((result.value - min) / (max - min)) * 70),
  );
  return (
    <div className="reference-range">
      <span>
        {formatNumber(min)}–{formatNumber(max)} {result.unit}
      </span>
      <div className="range-track" aria-hidden="true">
        <span className="range-normal" />
        <span
          className={`range-marker ${result.status !== "within" ? "range-marker--outside" : ""}`}
          style={{ left: `${fraction}%` }}
        />
      </div>
    </div>
  );
}
export function ResultsExplorer({
  report,
  trend,
}: {
  report: LabReport;
  trend: readonly { date: string; value: number }[];
}) {
  const { formatDate, formatNumber } = useFormatters();
  const t = useTranslations("copy");
  const [filter, setFilter] = useState<string>("all");
  const results = report.results.filter(
    (result) => filter === "all" || result.category === filter,
  );
  return (
    <>
      <Card padding="lg" className="record-toolbar">
        <div className="record-section-heading">
          <div>
            <h2>{t("laboratoryTestResults")}</h2>
            <p>{t("anOverviewOfParametersAndChangesBetween")}</p>
          </div>
          <Link className="text-link" href="/demo/luna/dokumenty?plik=badania">
            {t("previewSourceDocument")}
          </Link>
        </div>
        <p className="caption">
          {formatDate(report.date)} · {report.title} {t("fictionalData189")}
        </p>
        <div
          className="filter-list"
          role="group"
          aria-label={t("parameterGroup")}
        >
          {getFilters(t).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>
      <Card className="lab-trend-panel" padding="lg">
        <div className="record-section-heading">
          <div>
            <h3>{t("creatinineTrendCrea")}</h3>
            <p>{t("threeSampleMeasurementsMgDl")}</p>
          </div>
          <Badge tone="warning">{t("latestResult17MgDl")}</Badge>
        </div>
        <MeasurementChart
          label={t("creatinineAcrossTests")}
          unit="mg/dl"
          points={trend}
        />
      </Card>
      <Card padding="lg" className="full-results">
        <div className="record-section-heading">
          <h3>{t("laboratoryParameters")}</h3>
          <span role="status" className="caption">
            {t("numberOfParameters")} {results.length}
          </span>
        </div>
        <table className="detailed-results-table">
          <caption className="sr-only">
            {t("lunasResultsFrom")} {formatDate(report.date)}
            {t("previousTest12April2026")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("parameter")}</th>
              <th scope="col">{t("currentResult")}</th>
              <th scope="col">{t("previous")}</th>
              <th scope="col">{t("documentReferenceRange")}</th>
              <th scope="col">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr
                key={result.id}
                className={
                  result.status === "above" ? "result-above" : undefined
                }
              >
                <th scope="row">
                  {result.name}
                  <span className="caption">
                    {result.category
                      ? getCategoryLabels(t)[result.category]
                      : ""}
                  </span>
                </th>
                <td className="numeric">
                  <strong>{formatNumber(result.value)}</strong> {result.unit}
                </td>
                <td>
                  {result.previous !== undefined
                    ? `${formatNumber(result.previous)} ${result.unit}`
                    : t("noData")}
                </td>
                <td>
                  <ReferenceRange result={result} />
                </td>
                <td>
                  <Status status={result.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="detailed-results-mobile">
          {results.map((result) => (
            <article
              key={result.id}
              className={`result-mobile ${result.status === "above" ? "result-above" : ""}`}
            >
              <div>
                <h4>{result.name}</h4>
                <strong>
                  {formatNumber(result.value)} {result.unit}
                </strong>
              </div>
              <p>
                {t("previous202")}{" "}
                {result.previous !== undefined
                  ? `${formatNumber(result.previous)} ${result.unit}`
                  : t("noData")}
              </p>
              <ReferenceRange result={result} />
              <Status status={result.status} />
            </article>
          ))}
        </div>
        <p className="caption results-note">
          {t("rangesComeFromAFictionalDocumentPrevious")}
        </p>
      </Card>
    </>
  );
}
