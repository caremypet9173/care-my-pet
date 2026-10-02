"use client";
import { useLocale, useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import { useState } from "react";
import { IconSearch, IconLock } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentRow } from "./document-row";
import { DocumentDialog } from "./document-dialog";
import type { PetDocument } from "./types";
import type { LabReport } from "@/features/lab-results/types";

function getCategories(t: Translator) {
  return [
    { id: "all", label: t("all") },
    { id: "lab", label: t("testResults") },
    { id: "visit", label: t("dischargeNotesAndVisits") },
    { id: "vaccination", label: t("vaccinations") },
    { id: "invoice", label: t("receipts") },
  ] as const;
}
export function DocumentBrowser({
  documents,
  selectedId,
  report,
}: {
  documents: readonly PetDocument[];
  selectedId?: string;
  report: LabReport;
}) {
  const t = useTranslations("copy");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const filtered = documents.filter(
    (document) =>
      (category === "all" || category === document.category) &&
      `${document.title} ${document.source}`
        .toLocaleLowerCase(locale)
        .includes(query.trim().toLocaleLowerCase(locale)),
  );
  const selected = documents.find((document) => document.id === selectedId);
  return (
    <>
      <Card className="record-toolbar" padding="lg">
        <h2>{t("medicalDocumentsAndAttachments")}</h2>
        <p>{t("lunasTestResultsVisitNotesCertificatesAnd")}</p>
        <label className="record-search">
          <IconSearch size={19} aria-hidden="true" />
          <span className="sr-only">{t("searchDocuments")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchDocumentsByName")}
          />
        </label>
        <div
          className="filter-list"
          role="group"
          aria-label={t("documentCategory")}
        >
          {getCategories(t).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label} (
              {
                documents.filter(
                  (document) =>
                    item.id === "all" || item.id === document.category,
                ).length
              }
              )
            </button>
          ))}
        </div>
      </Card>
      <p className="document-readonly">
        <IconLock size={18} aria-hidden="true" />
        {t("youCanBrowseTheExamplesAddingAnd")}
      </p>
      <p className="filter-count" role="status">
        {t("numberOfDocuments")} {filtered.length}
      </p>
      <div className="document-list">
        {filtered.map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
      </div>
      {!filtered.length ? (
        <Card className="empty-state">
          <h3>{t("noMatchingDocuments")}</h3>
          <p>{t("tryADifferentNameOrCategory")}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            {t("clearFilters")}
          </Button>
        </Card>
      ) : null}
      {selectedId && !selected ? (
        <p role="status" className="document-readonly">
          {t("thisSampleDocumentCouldNotBeFound")}
        </p>
      ) : null}
      <DocumentDialog
        document={selected}
        documents={documents}
        report={report}
      />
    </>
  );
}
