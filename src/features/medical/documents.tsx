"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconEye,
  IconFiles,
  IconFileTypePdf,
  IconFlask,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PdfPreview } from "./pdf-preview";
import type { MedicalReport } from "./types";

const copy = {
  pl: {
    heading: "Dokumenty i załączniki medyczne",
    intro: "Oryginalne pliki zapisanych badań w jednym miejscu.",
    add: "Dodaj badanie",
    searchLabel: "Szukaj dokumentu po nazwie badania, pliku, laboratorium lub dacie",
    searchPlaceholder: "Np. morfologia, VetLab lub 2026-10",
    count: "Liczba dokumentów",
    noMatches: "Brak pasujących dokumentów. Zmień wyszukiwanie.",
    clearSearch: "Wyczyść wyszukiwanie",
    emptyTitle: "Nie ma jeszcze dokumentów",
    emptyBody: "Dodaj pierwsze badanie z załącznikiem PDF, JPG lub PNG.",
    labNotSpecified: "Nie podano laboratorium",
    parameters: "Liczba parametrów",
    descriptive: "Dokument opisowy",
    preview: "Podgląd",
    previewAria: "Podgląd dokumentu",
    openReport: "Szczegóły badania",
    close: "Zamknij podgląd",
    openNewTab: "Otwórz w nowej karcie",
    loading: "Ładowanie oryginału…",
    loadError: "Nie udało się wczytać pliku źródłowego. Spróbuj ponownie.",
    retry: "Spróbuj ponownie",
    metadataHeading: "Metadane dokumentu",
    testDate: "Data badania",
    confirmedAt: "Zatwierdzono w kartotece",
    laboratory: "Laboratorium / klinika",
    doctor: "Lekarz prowadzący",
    notSpecified: "Nie podano",
    fileName: "Nazwa pliku",
    fileFormat: "Format oryginału",
    notesHeading: "Opis / uwagi z dokumentu",
    relatedHeading: "Powiązane badanie",
    goToReport: "Przejdź do wyników badania →",
    previous: "Poprzedni dokument",
    next: "Następny dokument",
    position: (current: number, total: number) => `Dokument ${current} z ${total}`,
    securityTitle: "Prywatne archiwum dokumentacji:",
    securityBody:
      "Pliki źródłowe są dostępne wyłącznie dla domowników Twojego gospodarstwa. Podgląd generuje tymczasowy, podpisany link ważny przez 15 minut.",
    latest100:
      "Pokazano 100 najnowszych dokumentów oraz dokument otwarty z bezpośredniego odnośnika.",
    originalAlt: "Oryginał dokumentu",
  },
  en: {
    heading: "Medical documents and attachments",
    intro: "Original files of confirmed reports in one place.",
    add: "Add report",
    searchLabel: "Search documents by report title, file name, laboratory or date",
    searchPlaceholder: "E.g. blood count, VetLab or 2026-10",
    count: "Documents",
    noMatches: "No matching documents. Try another search.",
    clearSearch: "Clear search",
    emptyTitle: "No documents yet",
    emptyBody: "Add your first report with a PDF, JPG or PNG attachment.",
    labNotSpecified: "Laboratory not specified",
    parameters: "Parameters",
    descriptive: "Descriptive document",
    preview: "Preview",
    previewAria: "Preview document",
    openReport: "Report details",
    close: "Close preview",
    openNewTab: "Open in new tab",
    loading: "Loading original file…",
    loadError: "Could not load the source file. Please try again.",
    retry: "Try again",
    metadataHeading: "Document metadata",
    testDate: "Test date",
    confirmedAt: "Confirmed in record",
    laboratory: "Laboratory / clinic",
    doctor: "Veterinarian",
    notSpecified: "Not specified",
    fileName: "File name",
    fileFormat: "Original format",
    notesHeading: "Description / notes from document",
    relatedHeading: "Related report",
    goToReport: "Go to report results →",
    previous: "Previous document",
    next: "Next document",
    position: (current: number, total: number) => `Document ${current} of ${total}`,
    securityTitle: "Private document archive:",
    securityBody:
      "Source files are accessible only to members of your household. Previewing generates a temporary signed link valid for 15 minutes.",
    latest100:
      "Showing the latest 100 documents and any document opened via direct link.",
    originalAlt: "Original document",
  },
} as const;

function formatMimeLabel(mime: string) {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg") return "JPEG";
  return mime;
}

export function MedicalDocuments({
  petId,
  reports,
  initialDocumentId,
}: {
  petId: string;
  reports: MedicalReport[];
  initialDocumentId?: string;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const searchId = useId();
  const [query, setQuery] = useState("");
  const initialActive =
    initialDocumentId && reports.some((r) => r.id === initialDocumentId)
      ? initialDocumentId
      : null;
  const [activeId, setActiveId] = useState<string | null>(initialActive);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(initialActive);
  const [errorId, setErrorId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerIdRef = useRef<string | null>(null);

  const normalize = (value: string) =>
    value
      .toLocaleLowerCase(locale)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l");

  const filtered = reports.filter((report) =>
    normalize(
      `${report.title} ${report.source_name} ${report.laboratory} ${report.doctor} ${report.test_date}`,
    ).includes(normalize(query.trim())),
  );

  const navigationList =
    activeId && filtered.some((item) => item.id === activeId)
      ? filtered
      : reports;
  const activeIndex = activeId
    ? navigationList.findIndex((item) => item.id === activeId)
    : -1;
  const activeReport = activeIndex >= 0 ? navigationList[activeIndex] : null;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));

  async function ensureSignedUrl(report: MedicalReport, force = false) {
    if (!force && signedUrls[report.id]) return;
    setLoadingId(report.id);
    setErrorId(null);
    try {
      const { data, error } = await createClient()
        .storage.from("medical-documents")
        .createSignedUrl(report.source_path, 900);
      if (error || !data?.signedUrl) throw error ?? new Error("Missing URL");
      setSignedUrls((prev) => ({ ...prev, [report.id]: data.signedUrl }));
    } catch {
      setErrorId(report.id);
    } finally {
      setLoadingId((current) => (current === report.id ? null : current));
    }
  }

  function openDocument(report: MedicalReport) {
    triggerIdRef.current = report.id;
    setActiveId(report.id);
    void ensureSignedUrl(report);
  }

  function closeDocument() {
    const returnId = triggerIdRef.current ?? activeId;
    setActiveId(null);
    if (returnId) {
      requestAnimationFrame(() => {
        document.getElementById(`preview-document-${returnId}`)?.focus();
      });
    }
  }

  function stepDocument(nextReport: MedicalReport) {
    triggerIdRef.current = nextReport.id;
    setActiveId(nextReport.id);
    void ensureSignedUrl(nextReport);
  }

  useEffect(() => {
    if (!initialActive) return;
    const initial = reports.find((item) => item.id === initialActive);
    if (!initial) return;
    let cancelled = false;
    createClient()
      .storage.from("medical-documents")
      .createSignedUrl(initial.source_path, 900)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setErrorId(initial.id);
        } else {
          setSignedUrls((prev) => ({ ...prev, [initial.id]: data.signedUrl }));
        }
      })
      .catch(() => {
        if (!cancelled) setErrorId(initial.id);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingId((current) => (current === initial.id ? null : current));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialActive, reports]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (activeReport) {
      if (!element.open) {
        element.showModal();
      }
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    if (element.open) {
      element.close();
    }
  }, [activeReport]);

  const activeUrl = activeReport ? signedUrls[activeReport.id] : undefined;
  const isLoading = activeReport ? loadingId === activeReport.id && !activeUrl : false;
  const hasError = activeReport ? errorId === activeReport.id && !activeUrl : false;

  return (
    <div className="medical-documents">
      <section className="pet-panel medical-documents-toolbar">
        <header className="medical-documents-header">
          <div>
            <h2>{t.heading}</h2>
            <p>{t.intro}</p>
          </div>
          <ButtonLink href={`/app/zwierzeta/${petId}/badania/nowe`} variant="secondary">
            <IconPlus size={18} aria-hidden="true" />
            {t.add}
          </ButtonLink>
        </header>
        <div className="medical-documents-search">
          <label htmlFor={searchId}>{t.searchLabel}</label>
          <div className="medical-documents-search-box">
            <IconSearch size={18} aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </div>
        </div>
        <p className="medical-documents-count" role="status">
          {t.count}: {filtered.length}
        </p>
        {!filtered.length ? (
          reports.length ? (
            <div className="medical-documents-empty-search">
              <p>{t.noMatches}</p>
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                {t.clearSearch}
              </Button>
            </div>
          ) : (
            <div className="medical-documents-empty">
              <IconFiles size={36} aria-hidden="true" />
              <h3>{t.emptyTitle}</h3>
              <p>{t.emptyBody}</p>
            </div>
          )
        ) : (
          <ul className="medical-documents-list">
            {filtered.map((report) => {
              const isPdf = report.source_mime === "application/pdf";
              const formatLabel = formatMimeLabel(report.source_mime);
              return (
                <li key={report.id} className="medical-document-card">
                  <div className="medical-document-main">
                    <span
                      className={`medical-document-badge ${isPdf ? "medical-document-badge--pdf" : "medical-document-badge--image"}`}
                      aria-hidden="true"
                    >
                      {isPdf ? <IconFileTypePdf size={22} /> : <IconPhoto size={22} />}
                    </span>
                    <div className="medical-document-info">
                      <div className="medical-document-title-row">
                        <h3>
                          <button type="button" onClick={() => openDocument(report)}>
                            {report.title}
                          </button>
                        </h3>
                        <span className="medical-document-tag">{formatLabel}</span>
                        <span className="medical-document-tag">
                          {report.rows.length
                            ? `${t.parameters}: ${report.rows.length}`
                            : t.descriptive}
                        </span>
                      </div>
                      <p className="medical-document-meta">
                        <time dateTime={report.test_date}>{formatDate(report.test_date)}</time>
                        {" · "}
                        <span>{report.laboratory || t.labNotSpecified}</span>
                        {" · "}
                        <span>{report.source_name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="medical-document-actions">
                    <button
                      id={`preview-document-${report.id}`}
                      type="button"
                      className="medical-document-preview-btn"
                      onClick={() => openDocument(report)}
                      aria-label={`${t.previewAria}: ${report.title}, ${report.test_date}`}
                    >
                      <IconEye size={17} aria-hidden="true" />
                      {t.preview}
                    </button>
                    <Link
                      className="medical-document-report-link"
                      href={`/app/zwierzeta/${petId}?tab=results&report=${report.id}`}
                    >
                      <IconFlask size={17} aria-hidden="true" />
                      {t.openReport}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {reports.length >= 100 && <p className="medical-documents-limit">{t.latest100}</p>}
      </section>

      <aside className="medical-results-disclaimer">
        <IconShieldCheck size={22} aria-hidden="true" />
        <p>
          <strong>{t.securityTitle}</strong> {t.securityBody}
        </p>
      </aside>

      <dialog
        ref={dialogRef}
        className="medical-document-dialog"
        aria-labelledby="medical-document-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDocument();
        }}
      >
        {activeReport ? (
          <div className="medical-document-dialog-shell">
            <header className="medical-document-dialog-header">
              <div className="medical-document-dialog-heading">
                <span className="medical-document-format-pill">
                  {formatMimeLabel(activeReport.source_mime)}
                </span>
                <h2 id="medical-document-dialog-title">{activeReport.title}</h2>
              </div>
              <div className="medical-document-dialog-controls">
                {activeUrl && (
                  <a
                    className="medical-document-external"
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconExternalLink size={16} aria-hidden="true" />
                    <span>{t.openNewTab}</span>
                  </a>
                )}
                <button
                  type="button"
                  className="medical-document-close"
                  onClick={closeDocument}
                  aria-label={t.close}
                >
                  <IconX size={20} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="medical-document-dialog-body">
              <div className="medical-document-viewer">
                {isLoading ? (
                  <p role="status" className="medical-document-status">
                    {t.loading}
                  </p>
                ) : hasError ? (
                  <div role="alert" className="medical-document-error">
                    <p>{t.loadError}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void ensureSignedUrl(activeReport, true)}
                    >
                      {t.retry}
                    </Button>
                  </div>
                ) : activeUrl ? (
                  activeReport.source_mime === "application/pdf" ? (
                    <PdfPreview key={activeUrl} url={activeUrl} />
                  ) : (
                    <div className="medical-document-image-frame">
                      {/* Private signed URL must not pass through the image optimization cache. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeUrl}
                        alt={`${t.originalAlt}: ${activeReport.title}`}
                      />
                    </div>
                  )
                ) : null}
              </div>

              <aside className="medical-document-sidebar">
                <section>
                  <h3>{t.metadataHeading}</h3>
                  <dl className="medical-document-dl">
                    <div>
                      <dt>{t.testDate}</dt>
                      <dd>
                        <time dateTime={activeReport.test_date}>
                          {formatDate(activeReport.test_date)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t.laboratory}</dt>
                      <dd>{activeReport.laboratory || t.notSpecified}</dd>
                    </div>
                    <div>
                      <dt>{t.doctor}</dt>
                      <dd>{activeReport.doctor || t.notSpecified}</dd>
                    </div>
                    <div>
                      <dt>{t.fileName}</dt>
                      <dd>{activeReport.source_name}</dd>
                    </div>
                    <div>
                      <dt>{t.fileFormat}</dt>
                      <dd>{formatMimeLabel(activeReport.source_mime)}</dd>
                    </div>
                    <div>
                      <dt>{t.parameters}</dt>
                      <dd>{activeReport.rows.length}</dd>
                    </div>
                    <div>
                      <dt>{t.confirmedAt}</dt>
                      <dd>
                        <time dateTime={activeReport.confirmed_at}>
                          {formatDate(activeReport.confirmed_at)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </section>

                {activeReport.notes && (
                  <section className="medical-document-notes">
                    <h3>{t.notesHeading}</h3>
                    <p>{activeReport.notes}</p>
                  </section>
                )}

                <section className="medical-document-related">
                  <h3>{t.relatedHeading}</h3>
                  <Link
                    className="medical-document-related-link"
                    href={`/app/zwierzeta/${petId}?tab=results&report=${activeReport.id}`}
                    onClick={() => {
                      document.body.style.overflow = "";
                    }}
                  >
                    {t.goToReport}
                  </Link>
                </section>
              </aside>
            </div>

            <footer className="medical-document-dialog-footer">
              {activeIndex > 0 ? (
                <button
                  type="button"
                  className="medical-document-nav-btn"
                  onClick={() => stepDocument(navigationList[activeIndex - 1])}
                >
                  <IconChevronLeft size={18} aria-hidden="true" />
                  {t.previous}
                </button>
              ) : (
                <span />
              )}
              <span aria-live="polite">
                {t.position(activeIndex + 1, navigationList.length)}
              </span>
              {activeIndex < navigationList.length - 1 ? (
                <button
                  type="button"
                  className="medical-document-nav-btn"
                  onClick={() => stepDocument(navigationList[activeIndex + 1])}
                >
                  {t.next}
                  <IconChevronRight size={18} aria-hidden="true" />
                </button>
              ) : (
                <span />
              )}
            </footer>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
