import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  IconCalendarEvent,
  IconScale,
  IconFlask,
  IconBowl,
  IconArrowRight,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LabResults } from "@/features/lab-results/lab-results";
import { MeasurementChart } from "@/features/pets/profile/measurement-chart";
import { DocumentRow } from "@/features/documents/document-row";
import { getLuna } from "@/fixtures/demo/luna";
import { getLunaEvents, getLunaDocuments } from "@/fixtures/demo/luna-record";
import { useFormatters } from "@/lib/formatters";

export default function DemoPage() {
  const t = useTranslations("copy");
  const { formatDate } = useFormatters();
  return (
    <>
      <h2 className="sr-only">{t("lunasRecordSummary")}</h2>
      <div className="profile-stats">
        <Link
          href="/demo/luna/historia#kontrola"
          className="stat-card stat-card--primary"
        >
          <div>
            <span>{t("nextAppointment")}</span>
            <IconCalendarEvent size={19} aria-hidden="true" />
          </div>
          <strong>{t("12October")}</strong>
          <p>{t("2026CheckUp")}</p>
        </Link>
        <Link href="#waga" className="stat-card stat-card--mint">
          <div>
            <span>{t("currentWeight")}</span>
            <IconScale size={19} aria-hidden="true" />
          </div>
          <strong>{t("42Kg")}</strong>
          <p>{t("unchangedSinceAugust3Measurements")}</p>
        </Link>
        <Link
          href="/demo/luna/wyniki"
          className="stat-card stat-card--lavender"
        >
          <div>
            <span>{t("latestTests")}</span>
            <IconFlask size={19} aria-hidden="true" />
          </div>
          <strong>{t("15Sept")}</strong>
          <p>
            2026 · {getLuna(t).report.results.length} {t("parameters")}
          </p>
        </Link>
        <div className="stat-card stat-card--peach">
          <div>
            <span>{t("foodAndMedication")}</span>
            <IconBowl size={19} aria-hidden="true" />
          </div>
          <strong>{t("noRegularMedication")}</strong>
          <p>{t("accordingToTheSampleRecord")}</p>
        </div>
      </div>
      <div className="profile-summary-grid">
        <div className="profile-main-column">
          <Card padding="lg">
            <div className="record-section-heading">
              <div>
                <h2>{t("recentEvents")}</h2>
                <p>{t("aChronologicalOverviewOfRecentEntries")}</p>
              </div>
              <Link href="/demo/luna/historia">
                {t("fullHistory")}{" "}
                <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="recent-events">
              {getLunaEvents(t)
                .slice(0, 2)
                .map((event) => (
                  <article key={event.id}>
                    <span
                      className={`event-dot event-dot--${event.category}`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="recent-event-heading">
                        <h3>{event.title}</h3>
                        <time dateTime={event.date}>
                          {formatDate(event.date)}
                        </time>
                      </div>
                      <p>{event.description}</p>
                      <Link
                        href={`/demo/luna/historia#${event.id}`}
                        className="text-link"
                      >
                        {t("viewEntry")}{" "}
                        <IconArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                ))}
            </div>
          </Card>
          <Card padding="lg">
            <div className="record-section-heading">
              <div>
                <h2>{t("latestTests")}</h2>
                <p>{t("selectedParametersFromTheLatestDocument")}</p>
              </div>
              <Link href="/demo/luna/wyniki">
                {t("allResults")}
                {getLuna(t).report.results.length})
              </Link>
            </div>
            <h3 className="sr-only">{t("laboratoryTest")}</h3>
            <LabResults
              report={{
                ...getLuna(t).report,
                results: getLuna(t).report.results.filter((item) =>
                  ["hgb", "crea", "urea"].includes(item.id),
                ),
              }}
            />
          </Card>
        </div>
        <aside
          className="profile-side-column"
          aria-label={t("weightAndDocuments")}
        >
          <Card id="waga" padding="md">
            <div className="record-section-heading">
              <div>
                <h2>{t("lunasWeight")}</h2>
                <p>{t("last3Months")}</p>
              </div>
              <Badge tone="success">{t("stable")}</Badge>
            </div>
            <MeasurementChart
              label={t("lunasWeightMeasurements")}
              unit="kg"
              points={getLuna(t).weights.map((item) => ({
                date: item.date,
                value: item.kg,
              }))}
            />
            <p className="caption">{t("theNextWeighInIsRecordedFor")}</p>
          </Card>
          <Card padding="md">
            <div className="record-section-heading">
              <h2>{t("documentsWithinReach")}</h2>
            </div>
            <div className="quick-documents">
              {getLunaDocuments(t)
                .slice(0, 2)
                .map((document) => (
                  <DocumentRow key={document.id} document={document} compact />
                ))}
            </div>
            <Link className="text-link" href="/demo/luna/dokumenty">
              {t("allFiles")}
              {getLunaDocuments(t).length}){" "}
              <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
