import {
  IconArrowRight,
  IconCalendar,
  IconFiles,
  IconFlask,
  IconInfoCircle,
  IconPlus,
  IconShieldCheck,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import type { HealthEvent } from "@/features/history/types";
import type {
  CalendarReportSummary,
  HouseholdNotificationSettings,
  ScheduleItem,
} from "@/features/schedule/types";
import { HouseholdSchedule } from "@/features/schedule/household-schedule";
import type {
  MedicationLog,
  MedicationSchedule,
} from "@/features/medications/types";
import type { Pet } from "./types";
import { PetIcon } from "./pet-icon";
import { petMessages } from "./messages";
import { dashboardMessages } from "./dashboard-messages";
import { EmptyHousehold } from "./empty-household";

export function HouseholdDashboard({
  pets,
  healthEvents = [],
  scheduleItems = [],
  reportsSummary = [],
  medicationSchedules = [],
  medicationLogs = [],
  notificationSettings,
  locale,
  canAddPet = true,
}: {
  pets: Pet[];
  healthEvents?: HealthEvent[];
  scheduleItems?: ScheduleItem[];
  reportsSummary?: CalendarReportSummary[];
  medicationSchedules?: MedicationSchedule[];
  medicationLogs?: MedicationLog[];
  notificationSettings?: HouseholdNotificationSettings;
  locale: Locale;
  canAddPet?: boolean;
}) {
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const pl = locale === "pl";
  if (pets.length === 0) return <EmptyHousehold locale={locale} canAddPet={canAddPet} />;

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));

  const petMap = new Map(pets.map((p) => [p.id, p]));

  const vaccinationEvents = healthEvents.filter(
    (ev) => ev.category === "vaccination",
  );

  const plannedDates: { petId: string; date: string; title: string }[] = [
    ...scheduleItems
      .filter((it) => it.status === "planned")
      .map((it) => ({
        petId: it.pet_id,
        date: it.scheduled_date,
        title: it.title,
      })),
    ...healthEvents
      .filter((ev) => ev.next_due_date !== null)
      .map((ev) => ({
        petId: ev.pet_id,
        date: ev.next_due_date!,
        title: ev.title,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const upcomingGlobal =
    plannedDates.find((dItem) => dItem.date >= todayIso) ??
    plannedDates[0] ??
    null;

  const stats = [
    {
      icon: IconFiles,
      title: `${pets.length} · ${d.records}`,
      text: pets.map((pet) => pet.imie).join(", ") || t.emptyBody,
    },
    {
      icon: IconFlask,
      title: d.results,
      text: `${pets.reduce((sum, pet) => sum + (pet.report_count ?? 0), 0)}`,
    },
    {
      icon: IconShieldCheck,
      title: d.vaccinations,
      text:
        vaccinationEvents.length > 0
          ? pl
            ? `${vaccinationEvents.length} zapisanych`
            : `${vaccinationEvents.length} recorded`
          : d.noData,
    },
    {
      icon: IconCalendar,
      title: d.nextVisit,
      text: upcomingGlobal
        ? `${formatDate(upcomingGlobal.date)} · ${petMap.get(upcomingGlobal.petId)?.imie ?? ""}`
        : pl
          ? "Brak zaplanowanych"
          : "None scheduled",
    },
  ];

  return (
    <>
      <section className="household-digest" aria-label={d.summary}>
        {stats.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <span className="digest-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="household-section-heading">
        <h2>{d.profiles}</h2>
        <span>
          {pets.length} · {d.records}
        </span>
      </div>

      <div className="pets-grid">
        {pets.map((pet) => {
          const petEvents = healthEvents.filter((ev) => ev.pet_id === pet.id);
          const petSchedule = scheduleItems.filter(
            (it) => it.pet_id === pet.id && it.status === "planned",
          );
          const lastVisitEv =
            petEvents.find((ev) => ev.category === "visit") ?? petEvents[0];

          const petUpcoming = [
            ...petSchedule.map((it) => ({
              date: it.scheduled_date,
              title: it.title,
            })),
            ...petEvents
              .filter((ev) => ev.next_due_date && ev.next_due_date >= todayIso)
              .map((ev) => ({
                date: ev.next_due_date!,
                title: ev.title,
              })),
          ].sort((a, b) => a.date.localeCompare(b.date))[0];

          const latestPreventionEv = petEvents.find(
            (ev) =>
              ev.category === "vaccination" || ev.category === "prevention",
          );
          const latestWithClinic =
            petEvents.find((ev) => ev.clinic.trim().length > 0) ??
            petSchedule.find((it) => it.clinic.trim().length > 0);

          const totalDocs = (pet.report_count ?? 0) + petEvents.length;

          return (
            <article className="pet-card" key={pet.id}>
              <div className="household-card-identity">
                <PetIcon
                  species={pet.gatunek}
                  src={pet.avatar_url}
                  name={pet.imie}
                />
                <div>
                  <h3>
                    {pet.imie}{" "}
                    <span className="household-tag">{t[pet.gatunek]}</span>
                  </h3>
                  <p>
                    {pet.rasa || t.missing} · {t[pet.plec]}
                  </p>
                  <span className="household-tag">
                    {pet.kastracja == null
                      ? `${t.kastracja}: ${t.unknown}`
                      : `${t.kastracja}: ${pet.kastracja ? t.yes : t.no}`}
                  </span>
                </div>
              </div>

              {(pet.tagi?.length ?? 0) > 0 && (
                <div className="household-card-care-tags" aria-label={t.tagi}>
                  {(pet.tagi ?? []).slice(0, 3).map((tag) => (
                    <span key={tag} className="household-care-tag">
                      {tag}
                    </span>
                  ))}
                  {(pet.tagi?.length ?? 0) > 3 && (
                    <span className="household-care-tag is-more">
                      +{(pet.tagi?.length ?? 0) - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="household-card-notice">
                <IconFiles size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {totalDocs > 0
                      ? pl
                        ? `Badania: ${pet.report_count ?? 0} · Wpisy historii: ${petEvents.length}`
                        : `Reports: ${pet.report_count ?? 0} · History entries: ${petEvents.length}`
                      : d.medicalEmpty}
                  </strong>
                  <p>
                    {pl
                      ? "Dodawaj badania, wizyty i pytaj Asystenta AI w kartotece pupila."
                      : "Add reports, visits, and ask the AI Assistant in your pet’s record."}
                  </p>
                </div>
              </div>

              <dl className="household-card-facts">
                <div className={!lastVisitEv ? "is-empty" : undefined}>
                  <dt>{d.lastVisit}</dt>
                  <dd>
                    {lastVisitEv ? formatDate(lastVisitEv.event_date) : "—"}
                  </dd>
                </div>
                <div
                  className={
                    !petUpcoming && !latestPreventionEv ? "is-empty" : undefined
                  }
                >
                  <dt>{d.prevention}</dt>
                  <dd>
                    {petUpcoming
                      ? `${formatDate(petUpcoming.date)} (${petUpcoming.title})`
                      : latestPreventionEv
                        ? formatDate(latestPreventionEv.event_date)
                        : "—"}
                  </dd>
                </div>
                <div className={!latestWithClinic ? "is-empty" : undefined}>
                  <dt>{d.clinic}</dt>
                  <dd>{latestWithClinic ? latestWithClinic.clinic : "—"}</dd>
                </div>
              </dl>

              <Link
                className="button button--primary button--sm household-card-link"
                href={`/app/zwierzeta/${pet.id}`}
              >
                {d.record} <span className="sr-only">{pet.imie}</span>
                <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          );
        })}

        {canAddPet && (
          <Link className="pet-card pet-card--add" href="/app/zwierzeta/nowe">
            <span className="add-pet-icon">
              <IconPlus size={26} aria-hidden="true" />
            </span>
            <h3>{pets.length ? d.nextPet : t.empty}</h3>
            <p>{d.addHint}</p>
            <span className="household-add-label">+ {t.add}</span>
          </Link>
        )}
      </div>

      <HouseholdSchedule
        pets={pets}
        initialScheduleItems={scheduleItems}
        initialHealthEvents={healthEvents}
        initialReports={reportsSummary}
        initialMedicationSchedules={medicationSchedules}
        initialMedicationLogs={medicationLogs}
        initialNotificationSettings={notificationSettings}
      />

      <p className="household-advisory">
        <IconInfoCircle size={18} aria-hidden="true" />
        {d.note}
      </p>
    </>
  );
}
