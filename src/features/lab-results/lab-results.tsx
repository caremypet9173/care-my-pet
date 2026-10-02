import { useTranslations } from "next-intl";
import { Status } from "@/components/ui/badge";
import { useFormatters } from "@/lib/formatters";
import type { LabReport } from "./types";

export function LabResults({ report }: { report: LabReport }) {
  const t = useTranslations("copy");
  const { formatDate, formatNumber } = useFormatters();
  return (
    <div className="lab-results">
      <div className="lab-heading">
        <h4>{report.title}</h4>
        <p>
          {formatDate(report.date)} · {report.source}
        </p>
      </div>
      <table className="results-table">
        <caption className="sr-only">
          {t("testResultsFrom")} {formatDate(report.date)}
          {t("referenceRangesCopiedFromTheSampleDocument")}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("parameter")}</th>
            <th scope="col">{t("result")}</th>
            <th scope="col">{t("documentReferenceRange")}</th>
            <th scope="col">{t("status")}</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((result) => (
            <tr
              key={result.id}
              className={result.status === "above" ? "result-above" : undefined}
            >
              <th scope="row">{result.name}</th>
              <td className="numeric">
                {formatNumber(result.value)} {result.unit}
              </td>
              <td>
                {result.reference
                  ? `${formatNumber(result.reference.min)}–${formatNumber(result.reference.max)}`
                  : t("notProvided")}
              </td>
              <td>
                <Status status={result.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="results-mobile">
        {report.results.map((result) => (
          <div
            className={`result-mobile ${result.status === "above" ? "result-above" : ""}`}
            key={result.id}
          >
            <div>
              <h5>{result.name}</h5>
              <strong className="numeric">
                {formatNumber(result.value)} {result.unit}
              </strong>
            </div>
            <p>
              {t("documentReferenceRange179")}{" "}
              {result.reference
                ? `${formatNumber(result.reference.min)}–${formatNumber(result.reference.max)} ${result.unit}`
                : t("notProvided")}
            </p>
            <Status status={result.status} />
          </div>
        ))}
      </div>
      <p className="caption results-note">
        {t("theLabelRefersToTheRangeProvided")}
      </p>
    </div>
  );
}
