"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconEye,
  IconFiles,
  IconFileTypePdf,
  IconFlask,
  IconHistory,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HealthEvent } from "@/features/history/types";
import { FormattedMedicalText } from "./formatted-text";
import { PdfPreview } from "./pdf-preview";
import type { MedicalReport } from "./types";

type UnifiedDocument = {
  id: string;
  kind: "report" | "history";
  title: string;
  date: string;
  confirmed_at: string;
  laboratory: string;
  doctor: string;
  notes: string;
  ai_interpretation?: string;
  source_path: string;
  source_name: string;
  source_mime: string;
  badgeText: string;
  targetHref: string;
  targetButtonLabel: string;
  targetLinkLabel: string;
  parameterCount?: number;
};

const copy = {
  pl: {
    heading: "Dokumenty i załączniki medyczne",
    intro: "Oryginalne pliki zapisanych badań, wypisów z wizyt i szczepień w jednym miejscu.",
    add: "Dodaj badanie",
    searchLabel: "Szukaj dokumentu po nazwie badania/wizyty, pliku, klinice lub dacie",
    searchPlaceholder: "Np. morfologia, wypis, VetLab lub 2026-10",
    count: "Liczba dokumentów",
    noMatches: "Brak pasujących dokumentów. Zmień wyszukiwanie.",
    clearSearch: "Wyczyść wyszukiwanie",
    emptyTitle: "Nie ma jeszcze dokumentów",
    emptyBody: "Dodaj badanie lub wpis w historii zdrowia z załącznikiem PDF, JPG lub PNG.",
    labNotSpecified: "Nie podano placówki",
    parameters: "Liczba parametrów",
    descriptive: "Dokument opisowy",
    visitTag: "Wizyta kontrolna",
    vaccinationTag: "Szczepienie",
    preventionTag: "Leki i profilaktyka",
    preview: "Podgląd",
    previewAria: "Podgląd dokumentu",
    openReport: "Szczegóły badania",
    openHistory: "Oś czasu historii",
    close: "Zamknij podgląd",
    openNewTab: "Otwórz w nowej karcie",
    loading: "Ładowanie oryginału…",
    loadError: "Nie udało się wczytać pliku źródłowego. Spróbuj ponownie.",
    retry: "Spróbuj ponownie",
    metadataHeading: "Metadane dokumentu",
    testDate: "Data dokumentu",
    confirmedAt: "Zapisano w kartotece",
    laboratory: "Laboratorium / klinika",
    doctor: "Lekarz prowadzący",
    notSpecified: "Nie podano",
    fileName: "Nazwa pliku",
    fileFormat: "Format oryginału",
    notesHeading: "Opis / uwagi z dokumentu",
    relatedHeading: "Powiązany wpis",
    goToReport: "Przejdź do wyników badania →",
    goToHistory: "Przejdź do osi czasu historii →",
    previous: "Poprzedni dokument",
    next: "Następny dokument",
    position: (current: number, total: number) => `Dokument ${current} z ${total}`,
    securityTitle: "Prywatne archiwum dokumentacji:",
    securityBody:
      "Pliki źródłowe są dostępne wyłącznie dla domowników Twojego gospodarstwa. Podgląd generuje tymczasowy, podpisany link ważny przez 15 minut.",
    latest100:
      "Pokazano najnowsze dokumenty oraz dokument otwarty z bezpośredniego odnośnika.",
    originalAlt: "Oryginał dokumentu",
  },
  en: {
    heading: "Medical documents and attachments",
    intro: "Original files of confirmed lab reports, visit summaries, and vaccinations in one place.",
    add: "Add report",
    searchLabel: "Search documents by title, file name, clinic or date",
    searchPlaceholder: "E.g. blood count, visit summary, VetLab or 2026-10",
    count: "Documents",
    noMatches: "No matching documents. Try another search.",
    clearSearch: "Clear search",
    emptyTitle: "No documents yet",
    emptyBody: "Add a lab report or health history entry with a PDF, JPG or PNG attachment.",
    labNotSpecified: "Clinic not specified",
    parameters: "Parameters",
    descriptive: "Descriptive document",
    visitTag: "Check-up visit",
    vaccinationTag: "Vaccination",
    preventionTag: "Meds & prevention",
    preview: "Preview",
    previewAria: "Preview document",
    openReport: "Report details",
    openHistory: "Health timeline",
    close: "Close preview",
    openNewTab: "Open in new tab",
    loading: "Loading original file…",
    loadError: "Could not load the source file. Please try again.",
    retry: "Try again",
    metadataHeading: "Document metadata",
    testDate: "Document date",
    confirmedAt: "Saved in record",
    laboratory: "Laboratory / clinic",
    doctor: "Veterinarian",
    notSpecified: "Not specified",
    fileName: "File name",
    fileFormat: "Original format",
    notesHeading: "Description / notes from document",
    relatedHeading: "Related entry",
    goToReport: "Go to report results →",
    goToHistory: "Go to health history timeline →",
    previous: "Previous document",
    next: "Next document",
    position: (current: number, total: number) => `Document ${current} of ${total}`,
    securityTitle: "Private document archive:",
    securityBody:
      "Source files are accessible only to members of your household. Previewing generates a temporary signed link valid for 15 minutes.",
    latest100:
      "Showing the latest documents and any document opened via direct link.",
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
  healthEvents = [],
  initialDocumentId,
}: {
  petId: string;
  reports: MedicalReport[];
  healthEvents?: HealthEvent[];
  initialDocumentId?: string;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const searchId = useId();
  const [query, setQuery] = useState("");

  const documents = useMemo<UnifiedDocument[]>(() => {
    const reportDocs: UnifiedDocument[] = reports
      .filter((r) => Boolean(r.source_path))
      .map((r) => ({
        id: r.id,
        kind: "report",
        title: r.title,
        date: r.test_date,
        confirmed_at: r.confirmed_at,
        laboratory: r.laboratory,
        doctor: r.doctor,
        notes: r.notes,
        ai_interpretation: r.ai_interpretation,
        source_path: r.source_path,
        source_name: r.source_name,
        source_mime: r.source_mime,
        badgeText: r.rows.length
          ? `${t.parameters}: ${r.rows.length}`
          : t.descriptive,
        targetHref: `/app/zwierzeta/${petId}?tab=results&report=${r.id}`,
        targetButtonLabel: t.openReport,
        targetLinkLabel: t.goToReport,
        parameterCount: r.rows.length,
      }));

    const eventDocs: UnifiedDocument[] = healthEvents
      .filter(
        (ev): ev is HealthEvent & { source_path: string; source_name: string; source_mime: string } =>
          Boolean(ev.source_path && ev.source_name && ev.source_mime),
      )
      .map((ev) => ({
        id: ev.id,
        kind: "history",
        title: ev.title,
        date: ev.event_date,
        confirmed_at: ev.updated_at,
        laboratory: ev.clinic,
        doctor: ev.doctor,
        notes: ev.description,
        source_path: ev.source_path,
        source_name: ev.source_name,
        source_mime: ev.source_mime,
        badgeText:
          ev.category === "vaccination"
            ? t.vaccinationTag
            : ev.category === "prevention"
              ? t.preventionTag
              : t.visitTag,
        targetHref: `/app/zwierzeta/${petId}?tab=history`,
        targetButtonLabel: t.openHistory,
        targetLinkLabel: t.goToHistory,
      }));

    return [...reportDocs, ...eventDocs].sort(
      (a, b) => b.date.localeCompare(a.date) || b.confirmed_at.localeCompare(a.confirmed_at),
    );
  }, [reports, healthEvents, petId, t]);

  const initialActive =
    initialDocumentId && documents.some((d) => d.id === initialDocumentId)
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

  const filtered = documents.filter((doc) =>
    normalize(
      `${doc.title} ${doc.source_name} ${doc.laboratory} ${doc.doctor} ${doc.date} ${doc.badgeText}`,
    ).includes(normalize(query.trim())),
  );

  const navigationList =
    activeId && filtered.some((item) => item.id === activeId)
      ? filtered
      : documents;
  const activeIndex = activeId
    ? navigationList.findIndex((item) => item.id === activeId)
    : -1;
  const activeDocument = activeIndex >= 0 ? navigationList[activeIndex] : null;

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));

  async function ensureSignedUrl(doc: UnifiedDocument, force = false) {
    if (!force && signedUrls[doc.id]) return;
    setLoadingId(doc.id);
    setErrorId(null);
    try {
      const { data, error } = await createClient()
        .storage.from("medical-documents")
        .createSignedUrl(doc.source_path, 900);
      if (error || !data?.signedUrl) throw error ?? new Error("Missing URL");
      setSignedUrls((prev) => ({ ...prev, [doc.id]: data.signedUrl }));
    } catch {
      setErrorId(doc.id);
    } finally {
      setLoadingId((current) => (current === doc.id ? null : current));
    }
  }

  function openDocument(doc: UnifiedDocument) {
    triggerIdRef.current = doc.id;
    setActiveId(doc.id);
    void ensureSignedUrl(doc);
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

  function stepDocument(nextDoc: UnifiedDocument) {
    triggerIdRef.current = nextDoc.id;
    setActiveId(nextDoc.id);
    void ensureSignedUrl(nextDoc);
  }

  useEffect(() => {
    if (!initialActive) return;
    const initial = documents.find((item) => item.id === initialActive);
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
  }, [initialActive, documents]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (activeDocument) {
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
  }, [activeDocument]);

  const activeUrl = activeDocument ? signedUrls[activeDocument.id] : undefined;
  const isLoading = activeDocument ? loadingId === activeDocument.id && !activeUrl : false;
  const hasError = activeDocument ? errorId === activeDocument.id && !activeUrl : false;

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
          documents.length ? (
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
            {filtered.map((doc) => {
              const isPdf = doc.source_mime === "application/pdf";
              const formatLabel = formatMimeLabel(doc.source_mime);
              const TargetIcon = doc.kind === "report" ? IconFlask : IconHistory;
              return (
                <li key={doc.id} className="medical-document-card">
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
                          <button type="button" onClick={() => openDocument(doc)}>
                            {doc.title}
                          </button>
                        </h3>
                        <span className="medical-document-tag">{formatLabel}</span>
                        <span className="medical-document-tag">{doc.badgeText}</span>
                      </div>
                      <p className="medical-document-meta">
                        <time dateTime={doc.date}>{formatDate(doc.date)}</time>
                        {" · "}
                        <span>{doc.laboratory || t.labNotSpecified}</span>
                        {" · "}
                        <span>{doc.source_name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="medical-document-actions">
                    <button
                      id={`preview-document-${doc.id}`}
                      type="button"
                      className="medical-document-preview-btn"
                      onClick={() => openDocument(doc)}
                      aria-label={`${t.previewAria}: ${doc.title}, ${doc.date}`}
                    >
                      <IconEye size={17} aria-hidden="true" />
                      {t.preview}
                    </button>
                    <Link
                      className="medical-document-report-link"
                      href={doc.targetHref}
                    >
                      <TargetIcon size={17} aria-hidden="true" />
                      {doc.targetButtonLabel}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {documents.length >= 100 && <p className="medical-documents-limit">{t.latest100}</p>}
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
        {activeDocument ? (
          <div className="medical-document-dialog-shell">
            <header className="medical-document-dialog-header">
              <div className="medical-document-dialog-heading">
                <span className="medical-document-format-pill">
                  {formatMimeLabel(activeDocument.source_mime)}
                </span>
                <h2 id="medical-document-dialog-title">{activeDocument.title}</h2>
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
                      onClick={() => void ensureSignedUrl(activeDocument, true)}
                    >
                      {t.retry}
                    </Button>
                  </div>
                ) : activeUrl ? (
                  activeDocument.source_mime === "application/pdf" ? (
                    <PdfPreview key={activeUrl} url={activeUrl} />
                  ) : (
                    <div className="medical-document-image-frame">
                      {/* Private signed URL must not pass through the image optimization cache. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeUrl}
                        alt={`${t.originalAlt}: ${activeDocument.title}`}
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
                        <time dateTime={activeDocument.date}>
                          {formatDate(activeDocument.date)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t.laboratory}</dt>
                      <dd>{activeDocument.laboratory || t.notSpecified}</dd>
                    </div>
                    <div>
                      <dt>{t.doctor}</dt>
                      <dd>{activeDocument.doctor || t.notSpecified}</dd>
                    </div>
                    <div>
                      <dt>{t.fileName}</dt>
                      <dd>{activeDocument.source_name}</dd>
                    </div>
                    <div>
                      <dt>{t.fileFormat}</dt>
                      <dd>{formatMimeLabel(activeDocument.source_mime)}</dd>
                    </div>
                    {activeDocument.parameterCount !== undefined && (
                      <div>
                        <dt>{t.parameters}</dt>
                        <dd>{activeDocument.parameterCount}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{t.confirmedAt}</dt>
                      <dd>
                        <time dateTime={activeDocument.confirmed_at}>
                          {formatDate(activeDocument.confirmed_at)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </section>

                {activeDocument.notes && (
                  <section className="medical-document-notes">
                    <h3>{t.notesHeading}</h3>
                    <div className="medical-document-notes-box">
                      <FormattedMedicalText text={activeDocument.notes} />
                    </div>
                  </section>
                )}

                {activeDocument.ai_interpretation && (
                  <section className="medical-document-ai">
                    <div className="medical-document-ai-header">
                      <IconSparkles size={16} className="medical-ai-sparkle-icon" aria-hidden="true" />
                      <h3>{locale === "pl" ? "Wstępna analiza AI" : "Preliminary AI analysis"}</h3>
                    </div>
                    <div className="medical-document-notes-box">
                      <FormattedMedicalText text={activeDocument.ai_interpretation} />
                    </div>
                  </section>
                )}

                <section className="medical-document-related">
                  <h3>{t.relatedHeading}</h3>
                  <Link
                    className="medical-document-related-link"
                    href={activeDocument.targetHref}
                    onClick={() => {
                      document.body.style.overflow = "";
                    }}
                  >
                    {activeDocument.targetLinkLabel}
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
