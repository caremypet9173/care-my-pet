"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import {
  IconCalendar,
  IconClock,
  IconExternalLink,
  IconFileText,
  IconFlask,
  IconHeart,
  IconHistory,
  IconList,
  IconPill,
  IconScale,
  IconShieldCheck,
  IconSparkles,
  IconStethoscope,
  IconTable,
  IconVaccine,
  IconX,
} from "@tabler/icons-react";
import { PetHeroCover } from "@/features/pets/pet-hero-cover";
import { petMessages } from "@/features/pets/messages";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { petArchiveMessages } from "@/features/pets/archive-messages";
import type { Locale } from "@/i18n/types";
import { FormattedMedicalText } from "@/features/medical/formatted-text";
import { LabComparisonMatrix } from "@/features/medical/lab-comparison-matrix";
import { PdfPreview } from "@/features/medical/pdf-preview";
import { rangeStatus } from "@/features/medical/comparison";
import type { SharedPetRecordPayload } from "./types";

type TabId = "summary" | "history" | "results" | "weight";

export function SharedVetRecordView({
  token,
  payload,
}: {
  token: string;
  payload: SharedPetRecordPayload;
}) {
  const locale = useLocale() as "pl" | "en";
  const pl = locale === "pl";
  const t = petMessages[locale];
  const d = dashboardMessages[locale];

  const { share, pet, weights, health_events, reports, schedule_items } =
    payload;

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [resultsMode, setResultsMode] = useState<"matrix" | "single">(() =>
    reports.some((r) => r.rows.length > 0) ? "matrix" : "single",
  );
  const [selectedReportId, setSelectedReportId] = useState<string>(
    reports[0]?.id ?? "",
  );
  const [docPreview, setDocPreview] = useState<{
    title: string;
    mime: string;
    url: string;
  } | null>(null);
  const [docLoadingPath, setDocLoadingPath] = useState<string | null>(null);
  const [docError, setDocError] = useState("");

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  async function openSharedDocument(
    sourcePath: string,
    title: string,
    mime: string,
  ) {
    if (!sourcePath || docLoadingPath) return;
    setDocLoadingPath(sourcePath);
    setDocError("");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/pet-share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey ?? "",
        },
        body: JSON.stringify({
          action: "get_document_url",
          token,
          source_path: sourcePath,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.signed_url) {
        setDocError(
          pl
            ? "Nie udało się otworzyć oryginalnego dokumentu."
            : "Could not open source document.",
        );
        return;
      }
      setDocPreview({
        title,
        mime,
        url: String(body.signed_url),
      });
    } catch {
      setDocError(
        pl
          ? "Błąd połączenia podczas pobierania dokumentu."
          : "Connection error while loading document.",
      );
    } finally {
      setDocLoadingPath(null);
    }
  }

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const nextDueCandidate = [
    ...schedule_items.map((it) => ({
      date: it.scheduled_date,
      title: it.title,
    })),
    ...health_events
      .filter((ev) => ev.next_due_date && ev.next_due_date >= todayIso)
      .map((ev) => ({ date: ev.next_due_date!, title: ev.title })),
  ].sort((a, b) => a.date.localeCompare(b.date))[0];

  const latestCareEvent = health_events.find(
    (ev) => ev.category === "vaccination" || ev.category === "prevention",
  );

  const facts = [
    [t.rasa, pet.rasa ?? t.missing],
    [
      t.data_urodzenia,
      pet.data_urodzenia
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: "long",
            timeZone: "UTC",
          }).format(new Date(pet.data_urodzenia)) +
          (pet.data_urodzenia_przyblizona
            ? pl
              ? " (data przybliżona)"
              : " (approximate date)"
            : "")
        : t.unknown,
    ],
    ...(pet.archived_at && pet.archive_reason === "deceased" && pet.closed_on
      ? [
          [
            (petArchiveMessages[locale as Locale] ?? petArchiveMessages.pl).closedOnFact,
            new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
              timeZone: "UTC",
            }).format(new Date(pet.closed_on)),
          ],
        ]
      : []),
    ...(pet.archived_at && pet.archive_reason && pet.archive_reason !== "deceased"
      ? [
          [
            (petArchiveMessages[locale as Locale] ?? petArchiveMessages.pl).reasonFact,
            (petArchiveMessages[locale as Locale] ?? petArchiveMessages.pl).reasons[
              pet.archive_reason
            ].label,
          ],
        ]
      : []),
    [t.plec, t[pet.plec]],
    [
      t.kastracja,
      pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no,
    ],
    [t.identyfikacja, t[pet.identyfikacja]],
    ...(pet.numer_id ? [[t.numer_id, pet.numer_id]] : []),
  ];

  const selectedReport =
    reports.find((r) => r.id === selectedReportId) ?? reports[0] ?? null;

  return (
    <div className="shared-vet-page">
      <div className="shared-vet-banner">
        <div className="shared-vet-banner-left">
          <IconShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>
              {pl
                ? "Udostępniona kartoteka weterynaryjna (tylko do odczytu)"
                : "Shared veterinary medical record (read-only)"}
            </strong>
            <span>
              {share.label ? `${share.label} · ` : ""}
              {pl ? "Dostęp ważny do: " : "Valid until: "}
              <strong>{formatDateTime(share.expires_at)}</strong>
            </span>
          </div>
        </div>
      </div>

      <PetHeroCover
        pet={pet}
        locale={locale}
        badgeLabel={pl ? "Kartoteka pacjenta" : "Patient record"}
      />

      <div className="household-record-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "summary"}
          onClick={() => setActiveTab("summary")}
        >
          {pl ? "Podsumowanie" : "Summary"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        >
          {pl
            ? `Historia i szczepienia (${health_events.length})`
            : `History & vaccines (${health_events.length})`}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "results"}
          onClick={() => setActiveTab("results")}
        >
          {pl
            ? `Wyniki badań (${reports.length})`
            : `Lab & imaging reports (${reports.length})`}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "weight"}
          onClick={() => setActiveTab("weight")}
        >
          {pl ? `Waga (${weights.length})` : `Weight (${weights.length})`}
        </button>
      </div>

      {docError && (
        <p role="alert" className="medical-error">
          {docError}
        </p>
      )}

      {docPreview && (
        <section className="pet-panel medical-saved-source shared-doc-preview">
          <header>
            <h3>{docPreview.title}</h3>
            <div className="shared-doc-preview-actions">
              <a
                href={docPreview.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink size={15} aria-hidden="true" />{" "}
                {pl ? "Otwórz w nowej karcie" : "Open in new tab"}
              </a>
              <button
                type="button"
                className="schedule-mini-btn"
                onClick={() => setDocPreview(null)}
              >
                <IconX size={14} aria-hidden="true" />
                <span>{pl ? "Zamknij podgląd" : "Close"}</span>
              </button>
            </div>
          </header>
          {docPreview.mime === "application/pdf" ? (
            <PdfPreview key={docPreview.url} url={docPreview.url} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={docPreview.url} alt={docPreview.title} />
          )}
        </section>
      )}

      {activeTab === "summary" && (
        <>
          <div className="household-record-stats">
            {[
              {
                label: d.nextVisit,
                icon: IconCalendar,
                value: nextDueCandidate ? nextDueCandidate.date : "—",
                sub: nextDueCandidate
                  ? nextDueCandidate.title
                  : pl
                    ? "Brak zaplanowanych terminów"
                    : "No upcoming due dates",
              },
              {
                label: d.weight,
                icon: IconScale,
                value: weights[0]
                  ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(weights[0].kg)} kg`
                  : "—",
                sub: weights[0]
                  ? weights[0].measured_on
                  : pl
                    ? "Brak pomiarów"
                    : "No measurements",
              },
              {
                label: d.latest,
                icon: IconFlask,
                value: reports[0] ? reports[0].test_date : "—",
                sub: reports[0] ? reports[0].title : d.noResults,
              },
              {
                label: d.care,
                icon: IconHeart,
                value: latestCareEvent ? latestCareEvent.event_date : "—",
                sub: latestCareEvent
                  ? latestCareEvent.title
                  : pl
                    ? "Brak wpisów profilaktyki"
                    : "No prevention entries",
              },
            ].map(({ label, icon: Icon, value, sub }) => (
              <section key={label}>
                <Icon size={22} aria-hidden="true" />
                <h2>{label}</h2>
                <strong>{value}</strong>
                <p>{sub}</p>
              </section>
            ))}
          </div>

          <div className="household-record-columns">
            <div>
              <section className="pet-panel household-summary-reports">
                <h2>{d.events}</h2>
                {health_events.length ? (
                  <ul>
                    {health_events.slice(0, 6).map((ev) => {
                      const EvIcon =
                        ev.category === "vaccination"
                          ? IconVaccine
                          : ev.category === "prevention"
                            ? IconPill
                            : IconStethoscope;
                      return (
                        <li key={ev.id}>
                          <button
                            type="button"
                            className="shared-summary-row-btn"
                            onClick={() => setActiveTab("history")}
                          >
                            <EvIcon size={20} aria-hidden="true" />
                            <span>
                              <strong>{ev.title}</strong>
                              <small>
                                <time dateTime={ev.event_date}>
                                  {formatDate(ev.event_date)}
                                </time>
                                {ev.clinic && ` · ${ev.clinic}`}
                              </small>
                            </span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="household-inline-empty">
                    <IconHistory size={26} aria-hidden="true" />
                    <p>{d.noEvents}</p>
                  </div>
                )}
              </section>

              <section className="pet-panel household-summary-reports">
                <h2>{d.latest}</h2>
                {reports.length ? (
                  <ul>
                    {reports.slice(0, 6).map((rep) => (
                      <li key={rep.id}>
                        <button
                          type="button"
                          className="shared-summary-row-btn"
                          onClick={() => {
                            setSelectedReportId(rep.id);
                            setResultsMode("single");
                            setActiveTab("results");
                          }}
                        >
                          <IconFlask size={20} aria-hidden="true" />
                          <span>
                            <strong>{rep.title}</strong>
                            <small>
                              <time dateTime={rep.test_date}>
                                {formatDate(rep.test_date)}
                              </time>
                              {rep.laboratory && ` · ${rep.laboratory}`}
                            </small>
                          </span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{d.noResults}</p>
                )}
              </section>
            </div>

            <aside>
              <section className="pet-panel">
                <h2>{t.basics}</h2>
                <dl className="pet-facts">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </aside>
          </div>
        </>
      )}

      {activeTab === "history" && (
        <section className="pet-panel">
          <h2>
            {pl
              ? "Oś czasu wizyt, szczepień i profilaktyki"
              : "Visits, vaccinations and prevention timeline"}
          </h2>
          {health_events.length === 0 ? (
            <p>{d.noEvents}</p>
          ) : (
            <div className="shared-history-list">
              {health_events.map((ev) => {
                const EvIcon =
                  ev.category === "vaccination"
                    ? IconVaccine
                    : ev.category === "prevention"
                      ? IconPill
                      : IconStethoscope;
                return (
                  <article key={ev.id} className="shared-history-card">
                    <div className="shared-history-header">
                      <span
                        className={`schedule-compact-icon is-${ev.category}`}
                      >
                        <EvIcon size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <strong>{ev.title}</strong>
                        <small>
                          {formatDate(ev.event_date)}
                          {ev.clinic ? ` · ${ev.clinic}` : ""}
                          {ev.doctor ? ` · ${ev.doctor}` : ""}
                          {ev.batch_or_product
                            ? ` · ${ev.batch_or_product}`
                            : ""}
                        </small>
                      </div>
                      {ev.next_due_date && (
                        <span className="household-tag">
                          <IconClock size={13} aria-hidden="true" />{" "}
                          {pl ? "Następny termin: " : "Next due: "}
                          {formatDate(ev.next_due_date)}
                        </span>
                      )}
                      {ev.source_path && (
                        <button
                          type="button"
                          className="history-action-btn"
                          disabled={docLoadingPath === ev.source_path}
                          onClick={() =>
                            void openSharedDocument(
                              ev.source_path!,
                              ev.source_name || ev.title,
                              ev.source_mime || "application/pdf",
                            )
                          }
                        >
                          <IconFileText size={15} aria-hidden="true" />
                          <span>
                            {pl ? "Oryginał dokumentu" : "Source document"}
                          </span>
                        </button>
                      )}
                    </div>
                    {ev.description && (
                      <FormattedMedicalText
                        text={ev.description}
                        className="medical-notes"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === "results" && (
        <div className="medical-results">
          {reports.length === 0 ? (
            <section className="pet-panel">
              <p>{d.noResults}</p>
            </section>
          ) : (
            <>
              <div
                className="medical-mode-switcher"
                role="group"
                aria-label={pl ? "Widok wyników badań" : "Results view"}
              >
                <button
                  type="button"
                  className={`medical-mode-card is-highlight${resultsMode === "matrix" ? " is-active" : ""}`}
                  onClick={() => setResultsMode("matrix")}
                >
                  <span className="medical-mode-icon">
                    <IconTable size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {pl
                        ? "Porównanie parametrów w czasie"
                        : "Compare parameters over time"}
                    </strong>
                    <small>
                      {pl
                        ? "Zbiorcza tabela wszystkich wyników + wykres wielu parametrów"
                        : "Comparison matrix across dates + multi-parameter chart"}
                    </small>
                  </div>
                </button>
                <button
                  type="button"
                  className={`medical-mode-card${resultsMode === "single" ? " is-active" : ""}`}
                  onClick={() => setResultsMode("single")}
                >
                  <span className="medical-mode-icon">
                    <IconList size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {pl
                        ? "Pojedyncze badanie / opisowe (USG, RTG)"
                        : "Single / imaging report"}
                    </strong>
                    <small>
                      {pl
                        ? `Przeglądaj pojedyncze raporty i opisy (${reports.length})`
                        : `Browse individual reports (${reports.length})`}
                    </small>
                  </div>
                </button>
              </div>

              {resultsMode === "matrix" ? (
                <LabComparisonMatrix
                  reports={reports}
                  onOpenReport={(rep) => {
                    setSelectedReportId(rep.id);
                    setResultsMode("single");
                  }}
                  onOpenDocument={(rep) => {
                    if (rep.source_path) {
                      void openSharedDocument(
                        rep.source_path,
                        rep.source_name || rep.title,
                        rep.source_mime,
                      );
                    }
                  }}
                />
              ) : (
                <section className="pet-panel">
                  <div className="shared-report-toolbar">
                    <label className="medical-report-picker">
                      <IconCalendar size={18} aria-hidden="true" />
                      <select
                        value={selectedReport?.id ?? ""}
                        onChange={(e) => setSelectedReportId(e.target.value)}
                      >
                        {reports.map((r) => (
                          <option key={r.id} value={r.id}>
                            {formatDate(r.test_date)} · {r.title}
                            {r.laboratory ? ` (${r.laboratory})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedReport?.source_path && (
                      <button
                        type="button"
                        className="history-action-btn"
                        disabled={docLoadingPath === selectedReport.source_path}
                        onClick={() =>
                          void openSharedDocument(
                            selectedReport.source_path,
                            selectedReport.source_name || selectedReport.title,
                            selectedReport.source_mime,
                          )
                        }
                      >
                        <IconFileText size={15} aria-hidden="true" />
                        <span>
                          {pl
                            ? "Podgląd oryginału PDF / zdjęcia"
                            : "View original PDF / image"}
                        </span>
                      </button>
                    )}
                  </div>

                  {selectedReport && (
                    <div className="shared-report-body">
                      <h3>
                        {selectedReport.title} ·{" "}
                        {formatDate(selectedReport.test_date)}
                      </h3>
                      {(selectedReport.laboratory || selectedReport.doctor) && (
                        <p className="shared-report-sub">
                          {[selectedReport.laboratory, selectedReport.doctor]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}

                      {selectedReport.rows.length > 0 && (
                        <div className="medical-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>{pl ? "Parametr" : "Parameter"}</th>
                                <th>{pl ? "Wynik" : "Result"}</th>
                                <th>
                                  {pl
                                    ? "Zakres referencyjny"
                                    : "Reference range"}
                                </th>
                                <th>{pl ? "Status" : "Status"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedReport.rows.map((row, idx) => {
                                const status = rangeStatus(row);
                                return (
                                  <tr
                                    key={row.id ?? idx}
                                    className={
                                      status === "above" || status === "below"
                                        ? "medical-result-attention"
                                        : undefined
                                    }
                                  >
                                    <th scope="row">{row.name}</th>
                                    <td>
                                      <strong>{row.value}</strong> {row.unit}
                                    </td>
                                    <td>{row.reference || "—"}</td>
                                    <td>
                                      <span
                                        className={`medical-status medical-status--${status}`}
                                      >
                                        {status === "above"
                                          ? pl
                                            ? "↑ Powyżej"
                                            : "↑ High"
                                          : status === "below"
                                            ? pl
                                              ? "↓ Poniżej"
                                              : "↓ Low"
                                            : status === "within"
                                              ? pl
                                                ? "● W normie"
                                                : "● Normal"
                                              : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {selectedReport.notes && (
                        <FormattedMedicalText
                          text={selectedReport.notes}
                          className={`medical-notes${selectedReport.rows.length === 0 ? " is-descriptive" : ""}`}
                        />
                      )}

                      {selectedReport.ai_interpretation && (
                        <div className="shared-report-ai-card">
                          <div className="shared-report-ai-header">
                            <IconSparkles size={16} className="medical-ai-sparkle-icon" aria-hidden="true" />
                            <strong>{pl ? "Wstępna analiza AI badania" : "Preliminary AI report analysis"}</strong>
                          </div>
                          <FormattedMedicalText text={selectedReport.ai_interpretation} />
                          <small className="shared-report-ai-disclaimer">
                            {pl ? "Analiza pomocnicza AI — nie zastępuje diagnozy lekarskiej." : "Advisory AI analysis — does not replace veterinary diagnosis."}
                          </small>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "weight" && (
        <section className="pet-panel">
          <h2>{pl ? "Historia pomiarów wagi" : "Weight history"}</h2>
          {weights.length === 0 ? (
            <p>{pl ? "Brak pomiarów wagi." : "No weight measurements."}</p>
          ) : (
            <div className="medical-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{pl ? "Data pomiaru" : "Date"}</th>
                    <th>{pl ? "Waga" : "Weight"}</th>
                    <th>{pl ? "Uwagi" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {weights.map((w) => (
                    <tr key={w.id}>
                      <td>{formatDate(w.measured_on)}</td>
                      <td>
                        <strong>
                          {new Intl.NumberFormat(locale, {
                            maximumFractionDigits: 3,
                          }).format(w.kg)}{" "}
                          kg
                        </strong>
                      </td>
                      <td>{w.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
