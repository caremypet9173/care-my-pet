import "@/styles/pet-archive.css";
import {
  IconAlertCircle,
  IconArchive,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconFiles,
  IconFlask,
  IconInfoCircle,
  IconPill,
  IconPlus,
  IconShieldCheck,
  IconUpload,
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
import { projectMedicationDoses } from "@/features/medications/projection";
import type {
  MedicationLog,
  MedicationSchedule,
} from "@/features/medications/types";
import type { Pet } from "./types";
import { PetIcon } from "./pet-icon";
import { petMessages } from "./messages";
import { dashboardMessages } from "./dashboard-messages";
import { petArchiveMessages } from "./archive-messages";
import {
  EmptyHousehold,
  type EmptyHouseholdRecoveryLock,
} from "./empty-household";

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
  readOnly = false,
  recoveryLock = null,
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
  readOnly?: boolean;
  recoveryLock?: EmptyHouseholdRecoveryLock | null;
}) {
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const pl = locale === "pl";
  if (pets.length === 0) {
    return (
      <EmptyHousehold
        locale={locale}
        canAddPet={canAddPet}
        recoveryLock={recoveryLock}
      />
    );
  }
  const am = petArchiveMessages[locale];
  const activePets = pets.filter((pet) => !pet.archived_at);
  const archivedPets = pets.filter((pet) => !!pet.archived_at);
  const activePetIds = new Set(activePets.map((pet) => pet.id));
  const activeHealthEvents = healthEvents.filter((ev) => activePetIds.has(ev.pet_id));
  const activeScheduleItems = scheduleItems.filter((it) => activePetIds.has(it.pet_id));
  const activeReportsSummary = reportsSummary.filter((r) => activePetIds.has(r.pet_id));
  const activeMedicationSchedules = medicationSchedules.filter((s) => activePetIds.has(s.pet_id));
  const activeMedicationLogs = medicationLogs.filter((l) => activePetIds.has(l.pet_id));

  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));

  const petMap = new Map(activePets.map((p) => [p.id, p]));

  const vaccinationEvents = activeHealthEvents.filter(
    (ev) => ev.category === "vaccination",
  );

  const plannedDates: { petId: string; date: string; title: string }[] = [
    ...activeScheduleItems
      .filter((it) => it.status === "planned")
      .map((it) => ({
        petId: it.pet_id,
        date: it.scheduled_date,
        title: it.title,
      })),
    ...activeHealthEvents
      .filter((ev) => ev.next_due_date !== null)
      .map((ev) => ({
        petId: ev.pet_id,
        date: ev.next_due_date!,
        title: ev.title,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const upcomingGlobal =
    plannedDates.find((dItem) => dItem.date >= todayIso) ?? null;
  const overdueGlobal = plannedDates.filter((dItem) => dItem.date < todayIso);
  const latestOverdueGlobal = overdueGlobal[overdueGlobal.length - 1] ?? null;

  const stats = [
    {
      icon: IconFiles,
      title: `${activePets.length} · ${d.records}`,
      text: activePets.map((pet) => pet.imie).join(", ") || t.emptyBody,
    },
    {
      icon: IconFlask,
      title: d.results,
      text: `${activePets.reduce((sum, pet) => sum + (pet.report_count ?? 0), 0)}`,
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
      icon: !upcomingGlobal && latestOverdueGlobal ? IconAlertCircle : IconCalendar,
      title:
        !upcomingGlobal && latestOverdueGlobal
          ? pl
            ? "Zaległy termin"
            : "Overdue"
          : d.nextVisit,
      text: upcomingGlobal
        ? `${formatDate(upcomingGlobal.date)} · ${petMap.get(upcomingGlobal.petId)?.imie ?? ""}`
        : latestOverdueGlobal
          ? `${formatDate(latestOverdueGlobal.date)} · ${petMap.get(latestOverdueGlobal.petId)?.imie ?? ""}`
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
          {activePets.length} · {d.records}
        </span>
      </div>

      <div className="pets-grid">
        {activePets.map((pet) => {
          const petEvents = activeHealthEvents.filter((ev) => ev.pet_id === pet.id);
          const petSchedule = activeScheduleItems.filter(
            (it) => it.pet_id === pet.id && it.status === "planned",
          );
          const petOverdueSchedule = petSchedule
            .filter((it) => it.scheduled_date < todayIso)
            .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
          const petActiveSchedules = activeMedicationSchedules.filter(
            (s) => s.pet_id === pet.id && s.is_active && (!s.end_date || s.end_date >= todayIso),
          );
          const petTodayDoses =
            petActiveSchedules.length > 0
              ? projectMedicationDoses({
                  schedules: petActiveSchedules,
                  logs: activeMedicationLogs.filter((l) => l.pet_id === pet.id),
                  rangeStart: todayIso,
                  rangeEnd: todayIso,
                })
              : [];
          const petDoneDoses = petTodayDoses.filter((dose) => dose.is_completed).length;
          const petPendingDoses = petTodayDoses.filter(
            (dose) => !dose.is_completed && !dose.is_skipped,
          ).length;

          const lastVisitEv =
            petEvents.find((ev) => ev.category === "visit") ?? petEvents[0];

          const petUpcoming = [
            ...petSchedule
              .filter((it) => it.scheduled_date >= todayIso)
              .map((it) => ({
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

              {(petTodayDoses.length > 0 || petOverdueSchedule.length > 0) && (
                <div className="household-card-daily-pills">
                  {petTodayDoses.length > 0 && (
                    <span
                      className={`household-card-daily-pill${
                        petPendingDoses === 0 ? " is-done" : " is-pending"
                      }`}
                    >
                      {petPendingDoses === 0 ? (
                        <IconCheck size={13} aria-hidden="true" />
                      ) : (
                        <IconPill size={13} aria-hidden="true" />
                      )}
                      <span>
                        {pl
                          ? `Leki dziś: ${petDoneDoses}/${petTodayDoses.length}`
                          : `Meds today: ${petDoneDoses}/${petTodayDoses.length}`}
                      </span>
                    </span>
                  )}
                  {petOverdueSchedule.length > 0 && (
                    <span className="household-card-daily-pill is-overdue">
                      <IconAlertCircle size={13} aria-hidden="true" />
                      <span>
                        {pl
                          ? petOverdueSchedule.length === 1
                            ? "Zaległy termin"
                            : `Zaległe terminy (${petOverdueSchedule.length})`
                          : `${petOverdueSchedule.length} overdue`}
                      </span>
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
                  <dt>
                    {petUpcoming
                      ? d.prevention
                      : latestPreventionEv
                        ? pl
                          ? "Ostatnia profilaktyka"
                          : "Latest prevention"
                        : d.prevention}
                  </dt>
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

              <div className="household-card-actions">
                <Link
                  className="button button--primary button--sm household-card-link"
                  href={`/app/pets/${pet.id}`}
                >
                  {d.record} <span className="sr-only">{pet.imie}</span>
                  <IconArrowRight size={16} aria-hidden="true" />
                </Link>
                {!readOnly && (
                  <Link
                    className="button button--secondary button--sm household-card-upload"
                    href={`/app/pets/${pet.id}/results/new`}
                    title={`${d.upload} — ${pet.imie}`}
                    aria-label={`${d.upload} — ${pet.imie}`}
                  >
                    <IconUpload size={15} aria-hidden="true" />
                    <span>{pl ? "Badanie" : "Report"}</span>
                  </Link>
                )}
              </div>
            </article>
          );
        })}

        {canAddPet && (
          <Link className="pet-card pet-card--add" href="/app/pets/new">
            <span className="add-pet-icon">
              <IconPlus size={26} aria-hidden="true" />
            </span>
            <h3>{activePets.length ? d.nextPet : t.empty}</h3>
            <p>{d.addHint}</p>
            <span className="household-add-label">+ {t.add}</span>
          </Link>
        )}
      </div>

      <HouseholdSchedule
        pets={activePets}
        householdId={pets[0]?.gospodarstwo_id}
        initialScheduleItems={activeScheduleItems}
        initialHealthEvents={activeHealthEvents}
        initialReports={activeReportsSummary}
        initialMedicationSchedules={activeMedicationSchedules}
        initialMedicationLogs={activeMedicationLogs}
        initialNotificationSettings={notificationSettings}
        readOnly={readOnly}
      />

      {archivedPets.length > 0 && (
        <details className="household-archived-section">
          <summary className="household-archived-summary">
            <span className="household-archived-summary-left">
              <IconArchive size={17} aria-hidden="true" />
              <span>{am.dashboardArchivedTitle}</span>
              <span className="household-archived-count">{archivedPets.length}</span>
            </span>
          </summary>
          <div className="household-archived-list">
            {archivedPets.map((pet) => {
              const isDeceased = pet.archive_reason === "deceased";
              const reasonLabel = pet.archive_reason
                ? am.reasons[pet.archive_reason]?.label
                : am.heroBadgeClosed;
              return (
                <article className="household-archived-card" key={pet.id}>
                  <div className="household-archived-card-info">
                    <PetIcon
                      species={pet.gatunek}
                      src={pet.avatar_url}
                      name={pet.imie}
                    />
                    <div className="household-archived-card-meta">
                      <strong>{pet.imie}</strong>
                      <span>
                        {isDeceased
                          ? `${am.heroBadgeDeceased}${pet.closed_on ? ` · ${formatDate(pet.closed_on)}` : ""}`
                          : reasonLabel}
                      </span>
                    </div>
                  </div>
                  <Link
                    className="button button--secondary button--sm"
                    href={`/app/pets/${pet.id}`}
                  >
                    {am.dashboardOpenArchived}
                  </Link>
                </article>
              );
            })}
          </div>
        </details>
      )}

      <p className="household-advisory">
        <IconInfoCircle size={18} aria-hidden="true" />
        {d.note}
      </p>
    </>
  );
}
