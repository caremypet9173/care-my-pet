"use client";

import "@/styles/lab-matrix.css";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconChartLine,
  IconChevronDown,
  IconFileText,
  IconListDetails,
  IconSearch,
  IconStar,
  IconX,
} from "@tabler/icons-react";
import { medicalMessages } from "./messages";
import { numeric, rangeStatus } from "./comparison";
import {
  computeReferenceRatio,
  convertMeasurementValue,
  formatConvertedNumber,
  groupReportsByDate,
  normalizeUnit,
  resolveParameterIdentity,
  type UnitDimension,
} from "./parameter-normalization";
import type { Measurement, MedicalReport } from "./types";

type CategoryFilter = "all" | "blood" | "renal" | "liver" | "other";

export type MatrixColumn = {
  key: string;
  testDate: string;
  reports: MedicalReport[];
};

function getColumnCell(
  paramRow: MatrixParameterRow,
  col: MatrixColumn,
): { report: MedicalReport; cell: MatrixCellEntry } | null {
  for (const rep of col.reports) {
    const cell = paramRow.byReportId.get(rep.id);
    if (cell) return { report: rep, cell };
  }
  return null;
}

export type MatrixCellEntry = {
  row: Measurement;
  status: "within" | "above" | "below" | "unknown";
  numericValue: number | null;
  displayValue: string;
  converted: boolean;
  unitMismatch: boolean;
  referenceRatio: number | null;
};

export type MatrixParameterRow = {
  key: string;
  name: string;
  aliases: string[];
  dimension?: UnitDimension;
  unit: string;
  reference: string;
  category: "blood" | "renal" | "liver" | "other";
  isKey: boolean;
  hasAttention: boolean;
  numericPointCount: number;
  byReportId: Map<string, MatrixCellEntry>;
};

const SERIES_COLORS = [
  "#164d34",
  "#c2410c",
  "#2563eb",
  "#7c3aed",
  "#be185d",
  "#0d9488",
];

function foldText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function LabComparisonMatrix({
  reports,
  onOpenReport,
  onOpenDocument,
}: {
  reports: MedicalReport[];
  onOpenReport?: (report: MedicalReport) => void;
  onOpenDocument?: (report: MedicalReport) => void;
}) {
  const locale = useLocale() as "pl" | "en";
  const pl = locale === "pl";
  const t = medicalMessages[locale];
  const groupId = useId();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [onlyDeviations, setOnlyDeviations] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  const [selectedChartKeys, setSelectedChartKeys] = useState<string[]>([]);
  const [detailParamKey, setDetailParamKey] = useState<string | null>(null);
  const [mergedModalColKey, setMergedModalColKey] = useState<string | null>(
    null,
  );
  const chartSectionRef = useRef<HTMLDivElement>(null);

  // Sortujemy badania z parametrami malejąco po dacie (od najnowszych do najstarszych)
  const labReportsDesc = useMemo(() => {
    return [...reports]
      .filter((r) => r.rows.length > 0)
      .sort(
        (a, b) =>
          b.test_date.localeCompare(a.test_date) ||
          b.confirmed_at.localeCompare(a.confirmed_at),
      );
  }, [reports]);

  // Łączymy wszystkie badania laboratoryjne z tego samego dnia w jedną kolumnę daty
  const matrixColumnsDesc = useMemo<MatrixColumn[]>(() => {
    const grouped = groupReportsByDate(labReportsDesc, (rep) => rep.test_date);
    return grouped.map((g) => ({
      key: g.key,
      testDate: g.testDate,
      reports: g.items,
    }));
  }, [labReportsDesc]);

  // Budujemy wiersze parametrów ze słownikiem aliasów PL/EN i przeliczaniem jednostek do jednostki najnowszego badania
  const parameterRows = useMemo<MatrixParameterRow[]>(() => {
    const map = new Map<
      string,
      MatrixParameterRow & { aliasSet: Set<string> }
    >();

    // Krok 1: zbieramy surowe wpisy od najnowszego badania (domyślna jednostka/norma pochodzi z najświeższego wyniku)
    for (const rep of labReportsDesc) {
      for (const row of rep.rows) {
        const identity = resolveParameterIdentity(row, locale);
        const status = rangeStatus(row);
        const rawNum = numeric(row.value);

        let entry = map.get(identity.key);
        if (!entry) {
          entry = {
            key: identity.key,
            name: identity.displayName,
            aliases: [],
            aliasSet: new Set([row.name.trim(), identity.displayName]),
            dimension: identity.dimension,
            unit: row.unit.trim(),
            reference: row.reference.trim(),
            category: row.category,
            isKey: Boolean(row.is_key),
            hasAttention: false,
            numericPointCount: 0,
            byReportId: new Map(),
          };
          map.set(identity.key, entry);
        } else {
          entry.aliasSet.add(row.name.trim());
          if (!entry.unit && row.unit.trim()) {
            entry.unit = row.unit.trim();
          }
          if (!entry.reference && row.reference.trim()) {
            entry.reference = row.reference.trim();
          }
          if (entry.category === "other" && row.category !== "other") {
            entry.category = row.category;
          }
          if (row.is_key) {
            entry.isKey = true;
          }
        }

        if (!entry.byReportId.has(rep.id)) {
          entry.byReportId.set(rep.id, {
            row,
            status,
            numericValue: rawNum,
            displayValue: row.value,
            converted: false,
            unitMismatch: false,
            referenceRatio: computeReferenceRatio(row),
          });
          if (status === "above" || status === "below") {
            entry.hasAttention = true;
          }
        }
      }
    }

    // Krok 2: ujednolicamy wartości liczbowe do wspólnej jednostki wiersza (gdy dostępny jest bezpieczny przelicznik)
    const result: MatrixParameterRow[] = [];
    for (const entry of map.values()) {
      const targetUnitNorm = normalizeUnit(entry.unit);
      let numericCount = 0;

      for (const cell of entry.byReportId.values()) {
        const rawNum = cell.numericValue;
        const cellUnitNorm = normalizeUnit(cell.row.unit);

        if (
          rawNum !== null &&
          targetUnitNorm &&
          cellUnitNorm &&
          cellUnitNorm !== targetUnitNorm
        ) {
          const convertedNum = convertMeasurementValue(
            rawNum,
            cell.row.unit,
            entry.unit,
            entry.dimension,
          );
          if (convertedNum !== null) {
            cell.numericValue = convertedNum;
            cell.displayValue = formatConvertedNumber(convertedNum, locale);
            cell.converted = true;
          } else {
            cell.numericValue = null;
            cell.unitMismatch = true;
          }
        }

        if (cell.numericValue !== null && !cell.unitMismatch) {
          numericCount += 1;
        }
      }

      entry.numericPointCount = numericCount;
      entry.aliases = Array.from(entry.aliasSet).filter(Boolean);
      const { aliasSet: _unused, ...cleanEntry } = entry;
      void _unused;
      result.push(cleanEntry);
    }

    return result;
  }, [labReportsDesc, locale]);

  const filteredRows = useMemo(() => {
    const q = foldText(searchQuery.trim());
    return parameterRows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) {
        return false;
      }
      if (onlyDeviations && !row.hasAttention) {
        return false;
      }
      if (q) {
        const hay = foldText(
          `${row.name} ${row.aliases.join(" ")} ${row.unit} ${row.reference}`,
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [parameterRows, categoryFilter, onlyDeviations, searchQuery]);

  function toggleChartKey(key: string, scrollToChart = false) {
    const isAdding = !selectedChartKeys.includes(key);
    setSelectedChartKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 6) {
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
    if (scrollToChart && isAdding) {
      window.setTimeout(() => {
        chartSectionRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      }, 60);
    }
  }

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const deltaFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 4,
      }),
    [locale],
  );
  const formatDateShort = (iso: string) => shortDateFormatter.format(new Date(iso));

  if (labReportsDesc.length === 0) {
    return (
      <section className="pet-panel medical-empty">
        <IconFileText size={34} aria-hidden="true" />
        <h3>
          {pl
            ? "Brak wyników laboratoryjnych do porównania"
            : "No laboratory results to compare"}
        </h3>
        <p>
          {pl
            ? "Gdy dodasz badania z parametrami liczbowymi, zobaczysz tutaj zbiorczą tabelę porównawczą."
            : "Once you add reports with numeric parameters, a comparison matrix will appear here."}
        </p>
      </section>
    );
  }

  const categoriesOrder: ("blood" | "renal" | "liver" | "other")[] = [
    "blood",
    "renal",
    "liver",
    "other",
  ];

  const selectedSeriesRows = selectedChartKeys
    .map((k) => parameterRows.find((r) => r.key === k))
    .filter((r): r is MatrixParameterRow => Boolean(r));

  const activeDetailParam = detailParamKey
    ? parameterRows.find((r) => r.key === detailParamKey) ?? null
    : null;

  const activeMergedCol = mergedModalColKey
    ? matrixColumnsDesc.find((c) => c.key === mergedModalColKey) ?? null
    : null;

  const totalColumns = 2 + matrixColumnsDesc.length;

  return (
    <div className="matrix-comparison-wrap">
      <section className="pet-panel matrix-toolbar-panel">
        <div className="matrix-toolbar-top">
          <div>
            <h3>
              {pl
                ? "Porównanie wyników badań w czasie"
                : "Laboratory results comparison over time"}
            </h3>
            <p>
              {pl
                ? "Daty badań ułożone są od najnowszych (po lewej) do najstarszych. Zaznacz do 6 parametrów przy nazwie, aby porównać ich przebieg na wspólnym wykresie."
                : "Test dates are ordered from newest (left) to oldest. Check up to 6 parameters to compare their trends on a multi-line chart."}
            </p>
          </div>
        </div>

        <div className="medical-filters">
          {(["all", "blood", "renal", "liver", "other"] as const).map(
            (cat) => {
              const count =
                cat === "all"
                  ? parameterRows.length
                  : parameterRows.filter((r) => r.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={categoryFilter === cat}
                  onClick={() => {
                    setCategoryFilter(cat);
                    if (cat !== "all") {
                      setCollapsedCategories((prev) => ({
                        ...prev,
                        [cat]: false,
                      }));
                    }
                  }}
                >
                  {t[cat]} ({count})
                </button>
              );
            },
          )}
        </div>
      </section>

      <div ref={chartSectionRef} className="matrix-chart-anchor">
        {selectedSeriesRows.length > 0 && (
          <MultiParameterTrendChart
            seriesRows={selectedSeriesRows}
            columnsDesc={matrixColumnsDesc}
            onRemoveSeries={(key) => toggleChartKey(key)}
            onClearAll={() => setSelectedChartKeys([])}
            onOpenReport={onOpenReport}
            onOpenMergedColumn={(col) => setMergedModalColKey(col.key)}
          />
        )}
      </div>

      <section className="pet-panel medical-table-panel matrix-table-panel">
        <div className="matrix-table-filter-bar">
          <div className="schedule-search-box matrix-search-box">
            <IconSearch size={15} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                pl
                  ? "Szukaj parametru: np. kreatynina, ALT, WBC…"
                  : "Search parameter: e.g. creatinine, ALT, WBC…"
              }
              aria-label={pl ? "Szukaj parametru" : "Search parameter"}
            />
            {searchQuery && (
              <button
                type="button"
                className="schedule-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label={pl ? "Wyczyść" : "Clear"}
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="matrix-table-filter-actions">
            <label className="matrix-deviation-toggle">
              <input
                type="checkbox"
                checked={onlyDeviations}
                onChange={(e) => setOnlyDeviations(e.target.checked)}
              />
              <span>
                {pl ? "Tylko z odchyleniami" : "Only outside range"}
              </span>
            </label>
            <span className="matrix-filtered-count" aria-live="polite">
              {filteredRows.length} / {parameterRows.length}
            </span>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="matrix-empty-filtered">
            {pl
              ? "Brak parametrów spełniających wybrane filtry."
              : "No parameters match the selected filters."}
          </p>
        ) : (
          <div className="medical-table-scroll matrix-table-scroll">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th scope="col" className="matrix-col-param">
                    {pl ? "Parametr (wykres)" : "Parameter (chart)"}
                  </th>
                  <th scope="col" className="matrix-col-ref">
                    {pl
                      ? "Norma"
                      : "Ref."}
                  </th>
                  {matrixColumnsDesc.map((col) => {
                    const isMerged = col.reports.length > 1;
                    const singleRep = col.reports[0];
                    const labInfo = col.reports
                      .map((rep) =>
                        rep.laboratory && rep.laboratory !== rep.title
                          ? `${rep.laboratory} — ${rep.title}`
                          : rep.laboratory || rep.title,
                      )
                      .join(" · ");
                    const pdfReps = col.reports.filter((r) => Boolean(r.source_path));

                    return (
                      <th key={col.key} scope="col" className="matrix-col-date">
                        <div className="matrix-date-header">
                          {isMerged ? (
                            <button
                              type="button"
                              className="matrix-date-btn has-lab-tooltip"
                              onClick={() => setMergedModalColKey(col.key)}
                              data-lab={labInfo}
                              aria-label={`${pl ? "Badania z dnia" : "Reports on"}: ${col.testDate} (${col.reports.length})`}
                              title={
                                pl
                                  ? `${labInfo} (kliknij, aby wybrać badanie z tego dnia)`
                                  : `${labInfo} (click to choose report from this day)`
                              }
                            >
                              <strong>{formatDateShort(col.testDate)}</strong>
                              <small className="matrix-merged-badge">
                                {col.reports.length}{" "}
                                {pl ? "badania" : "reports"}
                              </small>
                            </button>
                          ) : onOpenReport ? (
                            <button
                              id={`open-report-${singleRep.id}`}
                              type="button"
                              className="matrix-date-btn has-lab-tooltip"
                              onClick={() => onOpenReport(singleRep)}
                              data-lab={labInfo}
                              aria-label={`${pl ? "Otwórz badanie" : "Open report"}: ${singleRep.title}, ${singleRep.test_date}`}
                              title={
                                pl
                                  ? `${labInfo} (kliknij, aby otworzyć szczegóły badania)`
                                  : `${labInfo} (click to open report details)`
                              }
                            >
                              <strong>{formatDateShort(singleRep.test_date)}</strong>
                            </button>
                          ) : (
                            <div
                              className="matrix-date-static has-lab-tooltip"
                              data-lab={labInfo}
                              title={labInfo}
                            >
                              <strong>{formatDateShort(col.testDate)}</strong>
                            </div>
                          )}
                          {onOpenDocument && pdfReps.length === 1 && (
                            <button
                              type="button"
                              className="matrix-doc-mini"
                              onClick={() => onOpenDocument(pdfReps[0])}
                              title={
                                pl
                                  ? "Pokaż oryginał dokumentu"
                                  : "View original document"
                              }
                            >
                              <IconFileText size={13} aria-hidden="true" />
                              <span>PDF</span>
                            </button>
                          )}
                          {onOpenDocument && pdfReps.length > 1 && (
                            <button
                              type="button"
                              className="matrix-doc-mini"
                              onClick={() => setMergedModalColKey(col.key)}
                              title={
                                pl
                                  ? "Wybierz dokument PDF z tego dnia"
                                  : "Choose PDF document from this day"
                              }
                            >
                              <IconFileText size={13} aria-hidden="true" />
                              <span>PDF ({pdfReps.length})</span>
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {categoriesOrder.map((category) => {
                const grouped = filteredRows.filter(
                  (r) => r.category === category,
                );
                if (grouped.length === 0) return null;
                const open = !collapsedCategories[category];
                const visibleRows = open ? grouped : [];

                return (
                  <Fragment key={category}>
                    <tbody className="medical-group-heading">
                      <tr>
                        <th colSpan={totalColumns} scope="rowgroup">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`${groupId}-${category}`}
                            onClick={() =>
                              setCollapsedCategories((prev) => ({
                                ...prev,
                                [category]: !prev[category],
                              }))
                            }
                          >
                            <IconChevronDown size={18} aria-hidden="true" />
                            <span>{t[category]}</span>
                            <span className="medical-group-count">
                              {grouped.length}
                            </span>
                            <span className="medical-group-action">
                              {pl
                                ? open
                                  ? "Zwiń"
                                  : "Rozwiń"
                                : open
                                  ? "Collapse"
                                  : "Expand"}
                            </span>
                          </button>
                        </th>
                      </tr>
                    </tbody>

                    <tbody id={`${groupId}-${category}`} hidden={!open}>
                      {visibleRows.map((paramRow) => {
                        const isChartSelected = selectedChartKeys.includes(
                          paramRow.key,
                        );
                        const seriesIndex = selectedChartKeys.indexOf(
                          paramRow.key,
                        );
                        const seriesColor =
                          seriesIndex >= 0
                            ? SERIES_COLORS[seriesIndex % SERIES_COLORS.length]
                            : undefined;

                        return (
                          <tr
                            key={paramRow.key}
                            className={
                              paramRow.hasAttention
                                ? "matrix-row-has-attention"
                                : undefined
                            }
                          >
                            <th scope="row" className="matrix-col-param">
                              <div className="matrix-param-cell">
                                <label
                                  className={`matrix-chart-check${paramRow.numericPointCount < 2 ? " is-disabled" : ""}`}
                                  title={
                                    paramRow.numericPointCount < 2
                                      ? pl
                                        ? "Wykres wymaga co najmniej 2 wyników liczbowych"
                                        : "Chart requires at least 2 numeric values"
                                      : pl
                                        ? "Dodaj/usuń parametr z wykresu porównawczego"
                                        : "Toggle parameter on comparison chart"
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    disabled={paramRow.numericPointCount < 2}
                                    checked={isChartSelected}
                                    onChange={() =>
                                      toggleChartKey(paramRow.key, false)
                                    }
                                  />
                                  {seriesColor && (
                                    <span
                                      className="matrix-series-dot"
                                      style={{ background: seriesColor }}
                                    />
                                  )}
                                </label>
                                <div className="matrix-param-title">
                                  {paramRow.numericPointCount >= 2 ? (
                                    <button
                                      type="button"
                                      className={`matrix-param-btn${isChartSelected ? " is-selected" : ""}`}
                                      onClick={() =>
                                        toggleChartKey(paramRow.key, true)
                                      }
                                      title={
                                        pl
                                          ? "Kliknij, aby pokazać/ukryć parametr na wykresie i przewinąć do wykresu"
                                          : "Click to toggle parameter on chart and scroll to chart"
                                      }
                                    >
                                      <span className="matrix-param-name-stack">
                                        <strong>
                                          {paramRow.name}
                                          {paramRow.isKey && (
                                            <IconStar
                                              size={13}
                                              aria-label={
                                                pl
                                                  ? "Kluczowy parametr"
                                                  : "Key parameter"
                                              }
                                            />
                                          )}
                                        </strong>
                                        {(paramRow.reference || paramRow.unit) && (
                                          <small className="matrix-mobile-ref">
                                            {paramRow.reference || "—"}
                                            {paramRow.unit ? ` ${paramRow.unit}` : ""}
                                          </small>
                                        )}
                                      </span>
                                      <ParameterSparkline
                                        paramRow={paramRow}
                                        columnsDesc={matrixColumnsDesc}
                                        strokeColor={seriesColor}
                                      />
                                    </button>
                                  ) : (
                                    <span className="matrix-param-name-stack">
                                      <strong>
                                        {paramRow.name}
                                        {paramRow.isKey && (
                                          <IconStar
                                            size={13}
                                            aria-label={
                                              pl
                                                ? "Kluczowy parametr"
                                                : "Key parameter"
                                            }
                                          />
                                        )}
                                      </strong>
                                      {(paramRow.reference || paramRow.unit) && (
                                        <small className="matrix-mobile-ref">
                                          {paramRow.reference || "—"}
                                          {paramRow.unit ? ` ${paramRow.unit}` : ""}
                                        </small>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="matrix-detail-btn"
                                  onClick={() => setDetailParamKey(paramRow.key)}
                                  title={
                                    pl
                                      ? `Szczegóły parametru: ${paramRow.name}`
                                      : `Parameter details: ${paramRow.name}`
                                  }
                                  aria-label={
                                    pl
                                      ? `Szczegóły parametru: ${paramRow.name}`
                                      : `Parameter details: ${paramRow.name}`
                                  }
                                >
                                  <IconListDetails size={15} aria-hidden="true" />
                                </button>
                              </div>
                            </th>

                            <td className="matrix-col-ref">
                              <span className="matrix-ref-range">
                                {paramRow.reference || "—"}
                              </span>
                              {paramRow.unit && (
                                <small className="matrix-ref-unit">
                                  {paramRow.unit}
                                </small>
                              )}
                            </td>

                            {matrixColumnsDesc.map((col, colIdx) => {
                              const found = getColumnCell(paramRow, col);
                              if (!found) {
                                return (
                                  <td
                                    key={col.key}
                                    className="matrix-cell is-empty"
                                  >
                                    —
                                  </td>
                                );
                              }

                              const { cell } = found;

                              // Szukamy starszego wyniku, by policzyć kierunek zmiany względem poprzedniego badania
                              let olderNum: number | null = null;
                              if (cell.numericValue !== null) {
                                for (
                                  let i = colIdx + 1;
                                  i < matrixColumnsDesc.length;
                                  i++
                                ) {
                                  const olderFound = getColumnCell(
                                    paramRow,
                                    matrixColumnsDesc[i],
                                  );
                                  if (
                                    olderFound &&
                                    olderFound.cell.numericValue !== null
                                  ) {
                                    olderNum = olderFound.cell.numericValue;
                                    break;
                                  }
                                }
                              }

                              const delta =
                                cell.numericValue !== null && olderNum !== null
                                  ? cell.numericValue - olderNum
                                  : null;

                              const hasDelta =
                                delta !== null && Math.abs(delta) > 1e-9;
                              const deltaSignClass = hasDelta
                                ? delta > 0
                                  ? " is-delta-pos"
                                  : " is-delta-neg"
                                : "";
                              const formattedDelta = hasDelta
                                ? `${delta > 0 ? "+" : ""}${deltaFormatter.format(Number(delta.toFixed(6)))}`
                                : "";

                              const originalInfo = cell.converted
                                ? pl
                                  ? `Przeliczono z: ${cell.row.value} ${cell.row.unit}`
                                  : `Converted from: ${cell.row.value} ${cell.row.unit}`
                                : "";
                              const deltaInfo = hasDelta
                                ? pl
                                  ? `Zmiana względem poprzedniego wyniku: ${formattedDelta}`
                                  : `Change vs. previous result: ${formattedDelta}`
                                : "";
                              const cellTitle = [originalInfo, deltaInfo]
                                .filter(Boolean)
                                .join(" · ");

                              return (
                                <td
                                  key={col.key}
                                  className={`matrix-cell is-${cell.status}${hasDelta ? ` has-delta-tooltip${deltaSignClass}` : ""}`}
                                  data-delta={hasDelta ? formattedDelta : undefined}
                                  title={cellTitle || undefined}
                                >
                                  <div className="matrix-cell-val">
                                    {cell.converted && (
                                      <span
                                        className="matrix-approx"
                                        aria-hidden="true"
                                      >
                                        ≈
                                      </span>
                                    )}
                                    <strong>{cell.displayValue}</strong>
                                    {cell.unitMismatch && cell.row.unit && (
                                      <small className="matrix-cell-unit">
                                        {cell.row.unit}
                                      </small>
                                    )}
                                    {cell.status === "above" && (
                                      <span
                                        className="matrix-flag is-above"
                                        title={t.above}
                                      >
                                        ↑
                                      </span>
                                    )}
                                    {cell.status === "below" && (
                                      <span
                                        className="matrix-flag is-below"
                                        title={t.below}
                                      >
                                        ↓
                                      </span>
                                    )}
                                    {cell.status === "within" && (
                                      <span
                                        className="matrix-flag is-within"
                                        title={t.within}
                                      >
                                        ●
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </Fragment>
                );
              })}
            </table>
          </div>
        )}
      </section>

      {activeDetailParam && (
        <ParameterDetailModal
          paramRow={activeDetailParam}
          reportsDesc={labReportsDesc}
          onClose={() => setDetailParamKey(null)}
          onOpenReport={onOpenReport}
          onOpenDocument={onOpenDocument}
        />
      )}

      {activeMergedCol && (
        <MergedDateReportsModal
          column={activeMergedCol}
          onClose={() => setMergedModalColKey(null)}
          onOpenReport={onOpenReport}
          onOpenDocument={onOpenDocument}
        />
      )}
    </div>
  );
}

function MergedDateReportsModal({
  column,
  onClose,
  onOpenReport,
  onOpenDocument,
}: {
  column: MatrixColumn;
  onClose: () => void;
  onOpenReport?: (report: MedicalReport) => void;
  onOpenDocument?: (report: MedicalReport) => void;
}) {
  const locale = useLocale() as "pl" | "en";
  const pl = locale === "pl";
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(column.testDate));

  return (
    <dialog
      ref={dialogRef}
      className="matrix-detail-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="matrix-detail-shell">
        <header className="matrix-detail-header">
          <div className="matrix-detail-title">
            <div className="matrix-detail-badges">
              <span className="matrix-key-pill">
                {column.reports.length} {pl ? "badania z tego dnia" : "reports on this date"}
              </span>
            </div>
            <h2>{formattedDate}</h2>
          </div>

          <button
            type="button"
            className="medical-document-close"
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="matrix-detail-body matrix-merged-body">
          <ul className="matrix-merged-list">
            {column.reports.map((rep) => (
              <li key={rep.id} className="matrix-merged-item">
                <div className="matrix-merged-info">
                  <strong>{rep.title}</strong>
                  <small>
                    {rep.laboratory || (pl ? "Laboratorium" : "Laboratory")} ·{" "}
                    {rep.rows.length}{" "}
                    {pl ? "parametrów" : "parameters"}
                  </small>
                </div>
                <div className="matrix-merged-actions">
                  {onOpenDocument && rep.source_path && (
                    <button
                      type="button"
                      className="matrix-doc-mini"
                      onClick={() => {
                        onClose();
                        onOpenDocument(rep);
                      }}
                    >
                      <IconFileText size={13} aria-hidden="true" />
                      <span>PDF</span>
                    </button>
                  )}
                  {onOpenReport && (
                    <button
                      type="button"
                      className="schedule-mini-btn"
                      onClick={() => {
                        onClose();
                        onOpenReport(rep);
                      }}
                    >
                      {pl ? "Otwórz badanie" : "Open report"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}

function ParameterDetailModal({
  paramRow,
  reportsDesc,
  onClose,
  onOpenReport,
  onOpenDocument,
}: {
  paramRow: MatrixParameterRow;
  reportsDesc: MedicalReport[];
  onClose: () => void;
  onOpenReport?: (report: MedicalReport) => void;
  onOpenDocument?: (report: MedicalReport) => void;
}) {
  const locale = useLocale() as "pl" | "en";
  const pl = locale === "pl";
  const t = medicalMessages[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const formatDateFull = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));

  // Wybieramy tylko raporty, w których ten parametr był mierzony (od najnowszych do najstarszych)
  const measuredEntries = useMemo(() => {
    const list: {
      report: MedicalReport;
      value: string;
      unit: string;
      originalValue: string;
      originalUnit: string;
      converted: boolean;
      reference: string;
      status: "within" | "above" | "below" | "unknown";
      numericValue: number | null;
      delta: number | null;
    }[] = [];

    for (let i = 0; i < reportsDesc.length; i++) {
      const rep = reportsDesc[i];
      const cell = paramRow.byReportId.get(rep.id);
      if (!cell) continue;

      let olderNum: number | null = null;
      if (cell.numericValue !== null) {
        for (let j = i + 1; j < reportsDesc.length; j++) {
          const olderCell = paramRow.byReportId.get(reportsDesc[j].id);
          if (olderCell && olderCell.numericValue !== null) {
            olderNum = olderCell.numericValue;
            break;
          }
        }
      }

      list.push({
        report: rep,
        value: cell.displayValue,
        unit: cell.converted ? paramRow.unit : cell.row.unit || paramRow.unit,
        originalValue: cell.row.value,
        originalUnit: cell.row.unit,
        converted: cell.converted,
        reference: cell.row.reference || paramRow.reference,
        status: cell.status,
        numericValue: cell.numericValue,
        delta:
          cell.numericValue !== null && olderNum !== null
            ? cell.numericValue - olderNum
            : null,
      });
    }
    return list;
  }, [paramRow, reportsDesc]);

  return (
    <dialog
      ref={dialogRef}
      className="matrix-detail-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="matrix-detail-shell">
        <header className="matrix-detail-header">
          <div className="matrix-detail-title">
            <div className="matrix-detail-badges">
              <span
                className={`medical-category medical-category--${paramRow.category}`}
              >
                {t[paramRow.category]}
              </span>
              {paramRow.isKey && (
                <span className="matrix-key-pill">
                  <IconStar size={12} aria-hidden="true" />
                  {pl ? "Kluczowy" : "Key"}
                </span>
              )}
            </div>
            <h2>{paramRow.name}</h2>
          </div>

          <button
            type="button"
            className="medical-document-close"
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="matrix-detail-meta">
          <div className="matrix-detail-meta-item">
            <span>{pl ? "Zakres referencyjny (norma)" : "Reference range"}</span>
            <strong>{paramRow.reference || "—"}</strong>
          </div>
          <div className="matrix-detail-meta-item">
            <span>{pl ? "Jednostka" : "Unit"}</span>
            <strong>{paramRow.unit || "—"}</strong>
          </div>
          <div className="matrix-detail-meta-item">
            <span>{pl ? "Liczba pomiarów" : "Measurements"}</span>
            <strong>{measuredEntries.length}</strong>
          </div>
        </div>

        <div className="matrix-detail-body">
          <table className="matrix-detail-table">
            <thead>
              <tr>
                <th scope="col">{pl ? "Data badania" : "Test date"}</th>
                <th scope="col">{pl ? "Wartość" : "Value"}</th>
              </tr>
            </thead>
            <tbody>
              {measuredEntries.map((entry) => {
                const hasDelta =
                  entry.delta !== null && Math.abs(entry.delta) > 1e-9;
                const formattedDelta = hasDelta
                  ? `${entry.delta! > 0 ? "+" : ""}${new Intl.NumberFormat(
                      locale,
                      {
                        maximumFractionDigits: 4,
                      },
                    ).format(Number(entry.delta!.toFixed(6)))}`
                  : null;

                return (
                  <tr
                    key={entry.report.id}
                    className={
                      entry.status === "above" || entry.status === "below"
                        ? "is-attention"
                        : undefined
                    }
                  >
                    <td>
                      <div className="matrix-detail-date-col">
                        {onOpenReport ? (
                          <button
                            type="button"
                            className="matrix-detail-report-link"
                            onClick={() => {
                              onClose();
                              onOpenReport(entry.report);
                            }}
                          >
                            {formatDateFull(entry.report.test_date)}
                          </button>
                        ) : (
                          <strong>{formatDateFull(entry.report.test_date)}</strong>
                        )}
                        <small>
                          {entry.report.laboratory || entry.report.title}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="matrix-detail-val-col">
                        <div className="matrix-detail-val-main">
                          <strong>
                            {entry.value}{" "}
                            {entry.unit && (
                              <span className="matrix-detail-unit">
                                {entry.unit}
                              </span>
                            )}
                          </strong>

                          {entry.status === "above" && (
                            <span
                              className="matrix-flag is-above"
                              title={t.above}
                            >
                              ↑
                            </span>
                          )}
                          {entry.status === "below" && (
                            <span
                              className="matrix-flag is-below"
                              title={t.below}
                            >
                              ↓
                            </span>
                          )}
                          {entry.status === "within" && (
                            <span
                              className="matrix-flag is-within"
                              title={t.within}
                            >
                              ●
                            </span>
                          )}

                          {formattedDelta && (
                            <span
                              className={`matrix-tooltip-delta ${entry.delta! > 0 ? "is-pos" : "is-neg"}`}
                              title={
                                pl
                                  ? "Zmiana względem poprzedniego badania"
                                  : "Change vs. previous test"
                              }
                            >
                              {formattedDelta}
                            </span>
                          )}
                        </div>

                        {entry.converted && (
                          <small className="matrix-detail-custom-ref">
                            {pl ? "Oryginalnie:" : "Original:"}{" "}
                            {entry.originalValue} {entry.originalUnit}
                          </small>
                        )}

                        {entry.reference &&
                          entry.reference !== paramRow.reference && (
                            <small className="matrix-detail-custom-ref">
                              {pl ? "Norma w tym badaniu:" : "Ref in this test:"}{" "}
                              {entry.reference}
                            </small>
                          )}

                        {onOpenDocument && entry.report.source_path && (
                          <button
                            type="button"
                            className="matrix-doc-mini"
                            onClick={() => {
                              onClose();
                              onOpenDocument(entry.report);
                            }}
                          >
                            <IconFileText size={12} aria-hidden="true" />
                            <span>PDF</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </dialog>
  );
}

function ParameterSparkline({
  paramRow,
  columnsDesc,
  strokeColor,
}: {
  paramRow: MatrixParameterRow;
  columnsDesc: MatrixColumn[];
  strokeColor?: string;
}) {
  const points: {
    val: number;
    status: "within" | "above" | "below" | "unknown";
  }[] = [];

  for (let i = columnsDesc.length - 1; i >= 0; i--) {
    const found = getColumnCell(paramRow, columnsDesc[i]);
    if (found && found.cell.numericValue !== null) {
      points.push({
        val: found.cell.numericValue,
        status: found.cell.status,
      });
    }
  }

  if (points.length < 2) return null;

  const refMatch = paramRow.reference
    .trim()
    .match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  const refLow = refMatch ? numeric(refMatch[1]) : null;
  const refHigh = refMatch ? numeric(refMatch[2]) : null;
  const hasRef = refLow !== null && refHigh !== null && refHigh > refLow;

  const vals = points.map((p) => p.val);
  const minVal = hasRef ? Math.min(refLow!, ...vals) : Math.min(...vals);
  const maxVal = hasRef ? Math.max(refHigh!, ...vals) : Math.max(...vals);
  const span = maxVal - minVal || Math.max(Math.abs(maxVal) * 0.1, 1);

  const w = 64;
  const h = 22;
  const padX = 4;
  const padY = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const coords = points.map((pt, idx) => ({
    ...pt,
    x: padX + (idx / (points.length - 1)) * innerW,
    y: h - padY - ((pt.val - minVal) / span) * innerH,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const lastPt = coords[coords.length - 1];
  const lineColor =
    strokeColor ??
    (lastPt.status === "above" || lastPt.status === "below"
      ? "#b45309"
      : "#164d34");

  const refBandTop = hasRef
    ? h - padY - ((refHigh! - minVal) / span) * innerH
    : 0;
  const refBandBottom = hasRef
    ? h - padY - ((refLow! - minVal) / span) * innerH
    : 0;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="matrix-sparkline"
      aria-hidden="true"
    >
      {hasRef && (
        <rect
          x={1}
          y={Math.min(refBandTop, refBandBottom)}
          width={w - 2}
          height={Math.max(2, Math.abs(refBandBottom - refBandTop))}
          fill="#dcfce7"
          rx={2}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPt.x}
        cy={lastPt.y}
        r={2.5}
        fill={lineColor}
        stroke="#fff"
        strokeWidth="1"
      />
    </svg>
  );
}

function MultiParameterTrendChart({
  seriesRows,
  columnsDesc,
  onRemoveSeries,
  onClearAll,
  onOpenReport,
  onOpenMergedColumn,
}: {
  seriesRows: MatrixParameterRow[];
  columnsDesc: MatrixColumn[];
  onRemoveSeries: (key: string) => void;
  onClearAll: () => void;
  onOpenReport?: (report: MedicalReport) => void;
  onOpenMergedColumn?: (col: MatrixColumn) => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const [scaleMode, setScaleMode] = useState<"normalized" | "relative">(
    "normalized",
  );
  const [hoveredColKey, setHoveredColKey] = useState<string | null>(null);
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Do wykresu czasu bierzemy kolumny rosnąco (od lewej najstarsze, do prawej najnowsze)
  const columnsAsc = useMemo(
    () => [...columnsDesc].reverse(),
    [columnsDesc],
  );

  // Zbieramy wyłącznie kolumny badań, w których przynajmniej jeden z wybranych parametrów ma wartość liczbową
  const activeColumns = useMemo(() => {
    return columnsAsc.filter((col) =>
      seriesRows.some((s) => {
        const found = getColumnCell(s, col);
        return Boolean(found && found.cell.numericValue !== null);
      }),
    );
  }, [columnsAsc, seriesRows]);

  const formatNum = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n);

  const formatDelta = (delta: number) => {
    const abs = Math.abs(delta);
    const maxDigits = abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
    const rounded = Number(delta.toFixed(maxDigits));
    return `${delta > 0 ? "+" : ""}${new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxDigits,
    }).format(rounded)}`;
  };

  const formatDateFull = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(iso));

  if (activeColumns.length < 2) {
    return (
      <section className="pet-panel matrix-chart-panel">
        <div className="matrix-chart-header">
          <div>
            <strong>
              {pl
                ? "Wykres porównawczy wybranych parametrów"
                : "Multi-parameter comparison chart"}
            </strong>
            <p>
              {pl
                ? "Wybrane parametry mają mniej niż dwa pomiary liczbowe — zaznacz parametry z co najmniej dwoma pomiarami."
                : "Selected parameters have fewer than two numeric measurements."}
            </p>
          </div>
          <button
            type="button"
            className="schedule-mini-btn"
            onClick={onClearAll}
          >
            {pl ? "Wyczyść wybór" : "Clear selection"}
          </button>
        </div>
      </section>
    );
  }

  // Równomierne rozmieszczenie kolejnych badań na osi X (chronologicznie od najstarszego do najnowszego),
  // dzięki czemu bliskie daty kontrolne nie zlewają się przy prawej krawędzi
  const xStart = 72;
  const xSpan = 586;
  const columnPositions = activeColumns.map((col, idx) => ({
    colKey: col.key,
    date: col.testDate,
    idx,
    x: xStart + (idx / (activeColumns.length - 1)) * xSpan,
    col,
  }));
  const xByColKey = new Map(columnPositions.map((cp) => [cp.colKey, cp.x]));
  const labelStride =
    activeColumns.length > 10 ? Math.ceil(activeColumns.length / 8) : 1;

  const seriesData = seriesRows.map((row, idx) => {
    const color = SERIES_COLORS[idx % SERIES_COLORS.length];
    const refMatch = row.reference
      .trim()
      .match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
    const refLow = refMatch ? numeric(refMatch[1]) : null;
    const refHigh = refMatch ? numeric(refMatch[2]) : null;
    const hasValidRef =
      refLow !== null && refHigh !== null && refHigh > refLow;

    const rawPoints: {
      colKey: string;
      date: string;
      rawVal: number;
      referenceRatio: number | null;
      delta: number | null;
      status: "within" | "above" | "below" | "unknown";
    }[] = [];

    for (const col of activeColumns) {
      const found = getColumnCell(row, col);
      if (found && found.cell.numericValue !== null) {
        const prevPoint =
          rawPoints.length > 0 ? rawPoints[rawPoints.length - 1] : null;
        rawPoints.push({
          colKey: col.key,
          date: col.testDate,
          rawVal: found.cell.numericValue,
          referenceRatio: found.cell.referenceRatio,
          delta: prevPoint ? found.cell.numericValue - prevPoint.rawVal : null,
          status: found.cell.status,
        });
      }
    }

    const minRaw = Math.min(...rawPoints.map((p) => p.rawVal));
    const maxRaw = Math.max(...rawPoints.map((p) => p.rawVal));
    const rawSpan = maxRaw - minRaw || Math.max(Math.abs(maxRaw) * 0.1, 1);

    const plotted = rawPoints.map((pt) => {
      const x = xByColKey.get(pt.colKey) ?? xStart;
      let yNorm = 0.5;
      if (scaleMode === "normalized" && (pt.referenceRatio !== null || hasValidRef)) {
        const ratio =
          pt.referenceRatio !== null
            ? pt.referenceRatio
            : (pt.rawVal - refLow!) / (refHigh! - refLow!);
        yNorm = Math.max(0.04, Math.min(0.96, 0.25 + ratio * 0.5));
      } else {
        yNorm = 0.15 + ((pt.rawVal - minRaw) / rawSpan) * 0.7;
      }
      const y = 175 - yNorm * 145;
      return { ...pt, x, y };
    });

    return {
      row,
      color,
      plotted,
    };
  });

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((e.clientX - rect.left) / rect.width) * 720;
    let closest = columnPositions[0];
    let minDiff = Math.abs(relX - closest.x);
    for (const cp of columnPositions) {
      const diff = Math.abs(relX - cp.x);
      if (diff < minDiff) {
        minDiff = diff;
        closest = cp;
      }
    }
    setHoveredColKey(closest.colKey);
  }

  const activeHoverInfo = hoveredColKey
    ? columnPositions.find((cp) => cp.colKey === hoveredColKey) ?? null
    : null;

  function handleChartClick() {
    if (!activeHoverInfo) return;
    const matchedReps = activeHoverInfo.col.reports.filter((rep) =>
      seriesRows.some((s) => s.byReportId.has(rep.id)),
    );
    if (matchedReps.length === 1 && onOpenReport) {
      onOpenReport(matchedReps[0]);
      return;
    }
    if (activeHoverInfo.col.reports.length === 1 && onOpenReport) {
      onOpenReport(activeHoverInfo.col.reports[0]);
      return;
    }
    if (activeHoverInfo.col.reports.length > 1 && onOpenMergedColumn) {
      onOpenMergedColumn(activeHoverInfo.col);
    }
  }

  return (
    <section className="pet-panel matrix-chart-panel">
      <div className="matrix-chart-header">
        <div>
          <h3>
            <IconChartLine size={18} aria-hidden="true" />{" "}
            {pl
              ? `Wykres wieloparametrowy (${seriesRows.length})`
              : `Multi-parameter trend chart (${seriesRows.length})`}
          </h3>
          <p>
            {scaleMode === "normalized"
              ? pl
                ? "Najedź na wykres, aby porównać wartości z wybranego dnia. Zielony pas = zakres referencyjny."
                : "Hover over the chart to inspect values for a given date. Green band = reference range."
              : pl
                ? "Najedź na wykres, aby porównać wartości. Skala własna (min–max każdego parametru)."
                : "Hover over the chart to inspect values. Relative min–max scale for each parameter."}
          </p>
        </div>

        <div className="matrix-chart-actions">
          <div className="schedule-layout-toggle" role="group">
            <button
              type="button"
              className={`schedule-layout-btn${scaleMode === "normalized" ? " is-active" : ""}`}
              onClick={() => setScaleMode("normalized")}
            >
              {pl ? "Względem normy" : " vs. Ref range"}
            </button>
            <button
              type="button"
              className={`schedule-layout-btn${scaleMode === "relative" ? " is-active" : ""}`}
              onClick={() => setScaleMode("relative")}
            >
              {pl ? "Skala własna (Min–Max)" : "Relative (Min–Max)"}
            </button>
          </div>

          <button
            type="button"
            className="schedule-mini-btn"
            onClick={onClearAll}
          >
            <IconX size={14} aria-hidden="true" />
            <span>{pl ? "Ukryj wykres" : "Clear chart"}</span>
          </button>
        </div>
      </div>

      <div className="matrix-chart-legend">
        {seriesData.map(({ row, color }) => {
          const isDimmed =
            hoveredSeriesKey !== null && hoveredSeriesKey !== row.key;
          return (
            <span
              key={row.key}
              className={`matrix-legend-pill${isDimmed ? " is-dimmed" : ""}`}
              onMouseEnter={() => setHoveredSeriesKey(row.key)}
              onMouseLeave={() => setHoveredSeriesKey(null)}
            >
              <span
                className="matrix-series-dot"
                style={{ background: color }}
              />
              <strong>{row.name}</strong>
              {row.unit && <small>({row.unit})</small>}
              <button
                type="button"
                onClick={() => onRemoveSeries(row.key)}
                aria-label={pl ? `Usuń ${row.name}` : `Remove ${row.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <div
        className="matrix-chart-stage"
        onMouseLeave={() => setHoveredColKey(null)}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 720 205"
          className="matrix-chart-svg is-interactive"
          onPointerMove={handlePointerMove}
          onClick={handleChartClick}
          role="img"
          aria-label={
            pl
              ? "Wykres porównawczy wybranych parametrów"
              : "Comparison chart of selected parameters"
          }
        >
          {scaleMode === "normalized" && (
            <g>
              <rect
                x="45"
                y={175 - 0.75 * 145}
                width="640"
                height={0.5 * 145}
                fill="#e8f3ed"
                opacity="0.7"
                rx="4"
              />
              <line
                x1="45"
                x2="685"
                y1={175 - 0.75 * 145}
                y2={175 - 0.75 * 145}
                stroke="#86efac"
                strokeDasharray="4 4"
              />
              <line
                x1="45"
                x2="685"
                y1={175 - 0.25 * 145}
                y2={175 - 0.25 * 145}
                stroke="#86efac"
                strokeDasharray="4 4"
              />
              <text
                x="40"
                y={179 - 0.75 * 145}
                textAnchor="end"
                fontSize="9"
                fill="#164d34"
              >
                MAX
              </text>
              <text
                x="40"
                y={179 - 0.5 * 145}
                textAnchor="end"
                fontSize="9"
                fill="#164d34"
              >
                {pl ? "NORMA" : "NORM"}
              </text>
              <text
                x="40"
                y={179 - 0.25 * 145}
                textAnchor="end"
                fontSize="9"
                fill="#164d34"
              >
                MIN
              </text>
            </g>
          )}

          {columnPositions.map(({ colKey, date: d, idx, x }) => {
            const isHovered = hoveredColKey === colKey;
            const showLabel =
              isHovered ||
              idx === 0 ||
              idx === columnPositions.length - 1 ||
              idx % labelStride === 0;
            return (
              <g key={colKey}>
                <line
                  x1={x}
                  x2={x}
                  y1="20"
                  y2="178"
                  stroke={isHovered ? "#164d34" : "#e7e5e4"}
                  strokeWidth={isHovered ? "1.75" : "1"}
                  strokeDasharray={isHovered ? "3 2" : "2 3"}
                />
                {showLabel && (
                  <text
                    x={x}
                    y="196"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isHovered ? "700" : "400"}
                    fill={isHovered ? "#164d34" : "#566b60"}
                  >
                    {new Intl.DateTimeFormat(locale, {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      timeZone: "UTC",
                    }).format(new Date(d))}
                  </text>
                )}
              </g>
            );
          })}

          {seriesData.map(({ row, color, plotted }) => {
            if (plotted.length < 2) return null;
            const isHighlighted = hoveredSeriesKey === row.key;
            const isDimmed =
              hoveredSeriesKey !== null && hoveredSeriesKey !== row.key;
            const pathD = plotted
              .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`)
              .join(" ");
            return (
              <g
                key={row.key}
                opacity={isDimmed ? 0.22 : 1}
                style={{ transition: "opacity 0.15s" }}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHighlighted ? "3.5" : "2.5"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {plotted.map((pt) => {
                  const isPointHovered = hoveredColKey === pt.colKey;
                  return (
                    <g key={`${row.key}-${pt.colKey}`}>
                      {isPointHovered && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={9}
                          fill={color}
                          opacity={0.18}
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={
                          isPointHovered
                            ? 6.5
                            : pt.status === "above" || pt.status === "below"
                              ? 5
                              : 4
                        }
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.75"
                      />
                      {(seriesData.length === 1 || isHighlighted) &&
                        !hoveredColKey && (
                          <text
                            x={pt.x}
                            y={pt.y - 9}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="700"
                            fill={color}
                          >
                            {formatNum(pt.rawVal)}
                          </text>
                        )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {activeHoverInfo && (
          <div
            className={`matrix-chart-tooltip${activeHoverInfo.x > 380 ? " is-left" : " is-right"}`}
            style={{
              left: `${(activeHoverInfo.x / 720) * 100}%`,
            }}
          >
            <div className="matrix-chart-tooltip-head">
              <strong>{formatDateFull(activeHoverInfo.date)}</strong>
              {(onOpenReport || onOpenMergedColumn) && (
                <small>
                  {activeHoverInfo.col.reports.map((r) => r.title).join(" · ")}
                  {" · "}
                  {pl
                    ? "Kliknij wykres, aby otworzyć badanie"
                    : "Click chart to open report"}
                </small>
              )}
            </div>
            <ul className="matrix-chart-tooltip-list">
              {seriesData.map(({ row, color, plotted }) => {
                const pt = plotted.find(
                  (p) => p.colKey === activeHoverInfo.colKey,
                );
                if (!pt) {
                  return (
                    <li key={row.key} className="is-missing">
                      <span
                        className="matrix-series-dot"
                        style={{ background: color }}
                      />
                      <span className="matrix-tooltip-name">{row.name}</span>
                      <span className="matrix-tooltip-val">—</span>
                    </li>
                  );
                }

                const hasDelta =
                  pt.delta !== null && Math.abs(pt.delta) > 1e-9;
                const deltaStr = hasDelta ? formatDelta(pt.delta!) : "";

                return (
                  <li key={row.key}>
                    <span
                      className="matrix-series-dot"
                      style={{ background: color }}
                    />
                    <span className="matrix-tooltip-name">{row.name}</span>
                    <span className="matrix-tooltip-val">
                      <strong>
                        {formatNum(pt.rawVal)} {row.unit}
                      </strong>
                      {pt.status === "above" && (
                        <span className="matrix-flag is-above">↑</span>
                      )}
                      {pt.status === "below" && (
                        <span className="matrix-flag is-below">↓</span>
                      )}
                      {pt.status === "within" && (
                        <span className="matrix-flag is-within">●</span>
                      )}
                      {hasDelta && (
                        <span
                          className={`matrix-tooltip-delta ${pt.delta! > 0 ? "is-pos" : "is-neg"}`}
                        >
                          {deltaStr}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
