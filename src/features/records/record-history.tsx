"use client";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/types";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import {
  IconCalendarEvent,
  IconFlask,
  IconVaccine,
  IconPill,
  IconSearch,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/lib/formatters";
import type { RecordEvent } from "./types";

function getCategories(t: Translator) {
  return [
    { id: "all", label: t("all") },
    { id: "visit", label: t("checkUps") },
    { id: "lab", label: t("tests") },
    { id: "vaccination", label: t("vaccinations") },
    { id: "prevention", label: t("preventiveCare") },
  ] as const;
}
const icons = {
  visit: IconCalendarEvent,
  lab: IconFlask,
  vaccination: IconVaccine,
  prevention: IconPill,
};
export function RecordHistory({ events }: { events: readonly RecordEvent[] }) {
  const { formatDate, formatMonth, locale } = useFormatters();
  const t = useTranslations("copy");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const filtered = events.filter(
    (event) =>
      (category === "all" || category === event.category) &&
      `${event.title} ${event.description} ${event.provider}`
        .toLocaleLowerCase(locale)
        .includes(query.trim().toLocaleLowerCase(locale)),
  );
  return (
    <>
      <Card className="record-toolbar" padding="lg">
        <h2>{t("lunasHealthHistory")}</h2>
        <p>{t("aChronologicalRecordOfVisitsResultsAnd")}</p>
        <label className="record-search">
          <IconSearch size={19} aria-hidden="true" />
          <span className="sr-only">{t("searchHistory")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchHistoryOrVisitNames")}
          />
        </label>
        <div className="filter-list" role="group" aria-label={t("eventType")}>
          {getCategories(t).map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={category === item.id}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>
      <p className="filter-count" role="status">
        {t("numberOfEntries")} {filtered.length}
      </p>
      <div className="health-timeline">
        {filtered.map((event, index) => {
          const Icon = icons[event.category];
          const month = event.date.slice(0, 7);
          const showMonth =
            index === 0 || filtered[index - 1].date.slice(0, 7) !== month;
          return (
            <div key={event.id}>
              {showMonth ? (
                <h3 className="timeline-month">{formatMonth(event.date)}</h3>
              ) : null}
              <article id={event.id} className="timeline-item">
                <span
                  className={`timeline-icon timeline-icon--${event.category}`}
                >
                  <Icon size={22} aria-hidden="true" />
                </span>
                <Card padding="lg">
                  <div className="record-section-heading">
                    <h4>{event.title}</h4>
                    <time dateTime={event.date}>{formatDate(event.date)}</time>
                  </div>
                  <p className="caption">{event.provider}</p>
                  <p className="timeline-description">{event.description}</p>
                  <details>
                    <summary>{t("entryDetails")}</summary>
                    <p>{event.detail}</p>
                  </details>
                  <div className="timeline-actions">
                    {event.documentId ? (
                      <Link
                        href={`/demo/luna/dokumenty?plik=${event.documentId}`}
                      >
                        {t("openRelatedDocument")}
                      </Link>
                    ) : null}
                    {event.category === "lab" ? (
                      <Link href="/demo/luna/wyniki">
                        {t("viewFullResults")}
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </article>
            </div>
          );
        })}
      </div>
      {!filtered.length ? (
        <Card className="empty-state">
          <h3>{t("noMatchingEntries")}</h3>
          <p>{t("changeYourSearchOrChooseADifferent")}</p>
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
    </>
  );
}
