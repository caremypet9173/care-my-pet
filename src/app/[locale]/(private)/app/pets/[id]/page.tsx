import { HouseholdSchedule } from "@/features/schedule/household-schedule";
import { listAssistantThreads, listAssistantMessages, getAssistantQuotaUsed } from "@/features/assistant/data";
import { ShareRecordButton } from "@/features/share/share-record-dialog";
import { ArchiveLinkButton } from "@/features/archive/archive-link-dialog";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPetRecordBundle } from "@/features/pets/record-bundle";
import { PetHeroCover } from "@/features/pets/pet-hero-cover";
import { PetSwitcher } from "@/features/pets/pet-switcher";
import { petMessages } from "@/features/pets/messages";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { petArchiveMessages } from "@/features/pets/archive-messages";
import { PetArchivedBanner } from "@/features/pets/pet-archived-notice";
import { RecordSections } from "@/features/pets/record-sections";
import {
  LazyAssistantPanel,
  LazyHealthMeasurementsPanel,
  LazyHistoryPanel,
  LazyMedicalDocuments,
  LazyMedicalResults,
} from "@/features/pets/record-tab-panels";
import type { Locale } from "@/i18n/types";
import { IconCalendar, IconScale, IconFlask, IconHeart, IconHistory, IconStethoscope, IconVaccine, IconPill } from "@tabler/icons-react";
import "@/styles/medical.css";
import "@/styles/medical-profile.css";
import { listReports } from "@/features/medical/data";
import {
  PetQuickAddProvider,
  PetQuickAddToolbarButton,
} from "@/features/pets/pet-quick-actions";
import { ActiveMedicationsCard } from "@/features/medications/active-medications-card";
import { DailyCareCard } from "@/features/pets/daily-care-card";
import { HouseholdRecoveryBanner } from "@/features/household/recovery-banner";
import type { Metadata } from "next";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [locale, { id }] = await Promise.all([getLocale(), params]);
  const bundle = await getPetRecordBundle(id);
  const pet = bundle?.pet ?? null;
  const pl = locale === "pl";

  if (!pet) {
    return {
      title: pl ? "Kartoteka pupila" : "Pet record",
    };
  }

  return {
    title: `${pet.imie} — ${pl ? "Kartoteka zdrowia" : "Health record"}`,
    description: pl
      ? `Kartoteka zdrowia pupila ${pet.imie}: historia leczenia, wyniki badań laboratoryjnych, waga i kalendarz opieki.`
      : `Health record for ${pet.imie}: medical history, lab test results, weight tracking, and care calendar.`,
  };
}

export default async function PetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{tab?:string;report?:string;document?:string;filter?:string;prompt?:string}> }) {
  const [locale, resolvedParams, resolvedSearch] = await Promise.all([
    getLocale(),
    params,
    searchParams,
  ]);
  const petId = resolvedParams.id;
  if (!UUID_RE.test(petId)) {
    notFound();
  }
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const requestedReport = resolvedSearch.report ?? resolvedSearch.document;
  const requestedPrompt = resolvedSearch.prompt;
  const tab = resolvedSearch.tab;
  const initialTab = tab === "history" ? 1 : tab === "results" ? 2 : tab === "documents" || (!tab && resolvedSearch.document) ? 3 : (tab === "weight" || tab === "measurements") ? 4 : tab === "assistant" || Boolean(requestedPrompt) ? 5 : 0;
  const initialTabQuery =
    tab && ["weight", "measurements", "history", "results", "documents", "assistant"].includes(tab)
      ? tab
      : resolvedSearch.document
        ? "documents"
        : requestedPrompt
          ? "assistant"
          : null;
  const isAssistantTab = initialTab === 5;

  // Single-round-trip RPC bundle (shared via React.cache with generateMetadata),
  // run in parallel with assistant queries only when the Assistant tab is active.
  const [
    bundle,
    assistantThreads,
    assistantMessages,
    assistantQuotaUsed,
  ] = await Promise.all([
    getPetRecordBundle(petId),
    isAssistantTab ? listAssistantThreads(petId) : Promise.resolve(undefined),
    isAssistantTab ? listAssistantMessages(petId) : Promise.resolve(undefined),
    isAssistantTab ? getAssistantQuotaUsed() : Promise.resolve(undefined),
  ]);

  if (!bundle) notFound();
  const {
    pet,
    householdDetails,
    switcherPets,
    notificationSettings,
    weights,
    vitalMeasurements,
    fluids,
    healthEvents,
    scheduleItems,
    medicationSchedules,
    medicationLogs,
  } = bundle;
  const reports =
    requestedReport &&
    UUID_RE.test(requestedReport) &&
    !bundle.reports.some((r) => r.id === requestedReport)
      ? await listReports(petId, requestedReport)
      : bundle.reports;
  const isArchived = Boolean(pet.archived_at);
  const isOwner = Boolean(
    householdDetails?.household?.is_owner ?? householdDetails?.owner?.is_self,
  );
  const canManage = Boolean(
    householdDetails?.household?.can_manage ?? isOwner,
  );
  const hasRecoveryKey = Boolean(householdDetails?.household?.has_recovery_key);
  const isReadOnly = isArchived || !hasRecoveryKey;
  const archiveMsgs = petArchiveMessages[locale as Locale] ?? petArchiveMessages.pl;
  const memberNames: Record<string, string> = {};
  if (householdDetails?.owner?.user_id) {
    memberNames[householdDetails.owner.user_id] = householdDetails.owner.email?.split("@")[0] || (locale === "pl" ? "Właściciel" : "Owner");
  }
  for (const m of householdDetails?.members ?? []) {
    if (m.user_id && m.email) {
      memberNames[m.user_id] = m.email.split("@")[0];
    }
  }
  const currentUserId = householdDetails?.owner?.is_self
    ? householdDetails.owner.user_id
    : householdDetails?.members.find((m) => m.is_self)?.user_id;
  const keyParameters=reports.flatMap(report=>report.rows.filter(row=>row.is_key).map(row=>({row,date:report.test_date})));
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
  const nextDueCandidate = [
    ...scheduleItems.filter(it => it.status === "planned").map(it => ({ date: it.scheduled_date, title: it.title })),
    ...healthEvents.filter(ev => ev.next_due_date && ev.next_due_date >= todayIso).map(ev => ({ date: ev.next_due_date!, title: ev.title })),
  ].sort((a, b) => a.date.localeCompare(b.date))[0];
  const latestCareEvent = healthEvents.find(ev => ev.category === "vaccination" || ev.category === "prevention");
  const activeMedications = medicationSchedules.filter(
    (s) => s.is_active && (!s.end_date || s.end_date >= todayIso),
  );
  const facts = [
    [t.rasa, pet.rasa ?? t.missing],
    [t.data_urodzenia, pet.data_urodzenia ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(pet.data_urodzenia)) + (pet.data_urodzenia_przyblizona ? (locale === "pl" ? " (data przybliżona)" : " (approximate date)") : "") : t.unknown],
    ...(pet.archived_at && pet.archive_reason === "deceased" && pet.closed_on
      ? [[archiveMsgs.closedOnFact, new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(pet.closed_on))]]
      : []),
    ...(pet.archived_at && pet.archive_reason && pet.archive_reason !== "deceased"
      ? [[archiveMsgs.reasonFact, archiveMsgs.reasons[pet.archive_reason].label]]
      : []),
    [t.plec, t[pet.plec]], [t.kastracja, pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no],
    [t.identyfikacja, t[pet.identyfikacja]], ...(pet.numer_id ? [[t.numer_id, pet.numer_id]] : []),
  ];
  const tabSyncKey = `${pet.id}:${initialTabQuery ?? ""}:${requestedReport ?? ""}:${resolvedSearch.filter ?? ""}:${requestedPrompt ?? ""}`;
  return <Container className="pets-page household-record"><PetQuickAddProvider pet={pet} householdId={pet.gospodarstwo_id} initialTab={initialTabQuery} tabSyncKey={tabSyncKey}><div className="household-record-toolbar"><div className="household-record-toolbar-nav"><Link href="/app" className="household-record-back">← {t.back}</Link><PetSwitcher pets={switcherPets} currentPetId={pet.id} locale={locale} initialTab={initialTabQuery} /></div><div className="household-record-toolbar-actions">{!isReadOnly && <PetQuickAddToolbarButton />}<ShareRecordButton petId={pet.id} petName={pet.imie} />{canManage && <ArchiveLinkButton petId={pet.id} petName={pet.imie} />}{!isReadOnly && <ButtonLink size="sm" variant="secondary" href={`/app/pets/${pet.id}/edit`}>{t.edit}</ButtonLink>}</div></div>
    <PetHeroCover
      pet={pet}
      locale={locale}
      badgeLabel={t.profile}
      updatedLabel={`${locale === "pl" ? "Ostatnia aktualizacja: " : "Last updated: "}${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(pet.updated_at))}`}
      editHref={isReadOnly ? undefined : `/app/pets/${pet.id}/edit`}
    />
    {householdDetails?.household && !hasRecoveryKey && (
      <HouseholdRecoveryBanner
        householdId={householdDetails.household.id}
        householdName={householdDetails.household.nazwa}
        ownerEmail={householdDetails.owner?.email ?? ""}
        recoveryEmail={householdDetails.household.recovery_email}
        canManage={isOwner}
        hasRecoveryKey={hasRecoveryKey}
      />
    )}
    <PetArchivedBanner pet={pet} locale={locale as Locale} isOwner={canManage} />
    <RecordSections key={`${pet.id}-${initialTab}-${requestedReport ?? ""}-${resolvedSearch.filter ?? ""}`} initialTab={initialTab} history={<LazyHistoryPanel petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} initialEvents={healthEvents} reports={reports} initialFluids={fluids} initialFilter={resolvedSearch.filter} readOnly={isReadOnly}/>} weight={<LazyHealthMeasurementsPanel petId={pet.id} petName={pet.imie} weights={weights} vitalMeasurements={vitalMeasurements} readOnly={isReadOnly}/>} results={<LazyMedicalResults key={ resolvedSearch.report } petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} reports={reports} initialReportId={resolvedSearch.report} readOnly={isReadOnly}/>} documents={<LazyMedicalDocuments key={resolvedSearch.document} petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} reports={reports} healthEvents={healthEvents} initialDocumentId={resolvedSearch.document} readOnly={isReadOnly}/>} assistant={<LazyAssistantPanel petId={pet.id} petName={pet.imie} initialThreads={assistantThreads} initialMessages={assistantMessages} initialQuotaUsed={assistantQuotaUsed} initialPrompt={requestedPrompt}/>}><DailyCareCard petId={pet.id} petName={pet.imie} schedules={medicationSchedules} initialLogs={medicationLogs} scheduleItems={scheduleItems} fluids={fluids} vitalMeasurements={vitalMeasurements} weights={weights} memberNames={memberNames} readOnly={isReadOnly}/><div className="household-record-stats">{[
      { label: d.nextVisit, icon: IconCalendar, value: nextDueCandidate ? nextDueCandidate.date : "—", sub: nextDueCandidate ? nextDueCandidate.title : (locale === "pl" ? "Brak zaplanowanych terminów" : "No upcoming due dates") },
      { label: d.weight, icon: IconScale, value: weights[0] ? `${new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(weights[0].kg)} kg` : "—", sub: weights[0] ? weights[0].measured_on : (locale === "pl" ? "Brak pomiarów" : "No measurements") },
      { label: d.latest, icon: IconFlask, value: reports[0] ? reports[0].test_date : "—", sub: reports[0] ? reports[0].title : d.noResults },
      {
        label: d.care,
        icon: activeMedications.length > 0 ? IconPill : IconHeart,
        value:
          activeMedications.length > 0
            ? locale === "pl"
              ? `${activeMedications.length} ${
                  activeMedications.length === 1
                    ? "aktywny lek"
                    : activeMedications.length < 5
                      ? "aktywne leki"
                      : "aktywnych leków"
                }`
              : `${activeMedications.length} active ${
                  activeMedications.length === 1 ? "medication" : "medications"
                }`
            : latestCareEvent
              ? latestCareEvent.event_date
              : "—",
        sub:
          activeMedications.length > 0
            ? activeMedications.map((m) => m.name).join(", ")
            : latestCareEvent
              ? latestCareEvent.title
              : locale === "pl"
                ? "Brak wpisów profilaktyki"
                : "No prevention entries",
      },
    ].map(({ label, icon: Icon, value, sub }) => <section key={label}><Icon size={22} aria-hidden="true" /><h2>{label}</h2><strong>{value}</strong><p>{sub}</p></section>)}</div>
    {keyParameters.length>0&&<section className="pet-panel"><h2>{locale==="pl"?"Kluczowe parametry":"Key parameters"}</h2><dl className="pet-facts">{keyParameters.map(({row,date})=><div key={row.id}><dt>{row.name} · {date}</dt><dd><strong>{row.value} {row.unit}</strong>{row.note&&<p className="pet-notes">{row.note}</p>}</dd></div>)}</dl></section>}
    <div className="household-record-columns"><div>
      <section className="pet-panel household-summary-reports household-summary-events"><h2>{d.events}</h2>
        {healthEvents.length ? <ul>{healthEvents.slice(0,5).map(ev=>{
          const EvIcon = ev.category === "vaccination" ? IconVaccine : ev.category === "prevention" ? IconPill : IconStethoscope;
          return <li key={ev.id}>
            <Link href={`/app/pets/${pet.id}?tab=history`}><EvIcon size={20} aria-hidden="true"/><span><strong>{ev.title}</strong><small><time dateTime={ev.event_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(ev.event_date))}</time>{ev.clinic&&` · ${ev.clinic}`}</small></span><span aria-hidden="true">→</span></Link>
          </li>;
        })}</ul> : <div className="household-inline-empty"><IconHistory size={26} aria-hidden="true" /><p>{d.noEvents}</p></div>}
        <Link className="household-summary-link" href={`/app/pets/${pet.id}?tab=history`}>{locale==='pl'?'Zobacz oś czasu historii zdrowia →':'View health history timeline →'}</Link>
      </section>
      <section className="pet-panel household-summary-reports household-summary-lab"><h2>{d.latest}</h2>
        {reports.length ? <ul>{reports.slice(0,5).map(report=><li key={report.id}>
          <Link href={`/app/pets/${pet.id}?tab=results&report=${report.id}`}><IconFlask size={20} aria-hidden="true"/><span><strong>{report.title}</strong><small><time dateTime={report.test_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(report.test_date))}</time>{report.laboratory&&` · ${report.laboratory}`}</small></span><span aria-hidden="true">→</span></Link>
        </li>)}</ul> : <p>{d.noResults}</p>}
        <Link className="household-summary-link" href={`/app/pets/${pet.id}?tab=results`}>{locale==='pl'?'Zobacz wszystkie badania →':'View all reports →'}</Link>
      </section>
    </div><aside><section className="pet-panel household-summary-basics"><h2>{t.basics}</h2><dl className="pet-facts">
      {facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div className="household-summary-weight"><dt>{d.weight}</dt><dd>{weights[0]?<><strong>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(weights[0].kg)} kg</strong><small className="household-summary-weight-date"><time dateTime={weights[0].measured_on}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(weights[0].measured_on))}</time></small></>:(locale==='pl'?'Brak pomiarów':'No measurements')}<Link className="household-summary-link" href={`/app/pets/${pet.id}?tab=weight`}>{locale==='pl'?'Pomiary zdrowia →':'Health measurements →'}</Link></dd></div>
    </dl></section>
    <ActiveMedicationsCard petId={pet.id} petName={pet.imie} initialSchedules={medicationSchedules} initialLogs={medicationLogs} memberNames={memberNames} currentUserId={currentUserId} pets={[{ id: pet.id, imie: pet.imie }]} petData={{ id: pet.id, imie: pet.imie, gatunek: pet.gatunek, rasa: pet.rasa, data_urodzenia: pet.data_urodzenia, data_urodzenia_przyblizona: pet.data_urodzenia_przyblizona, plec: pet.plec, kastracja: pet.kastracja, identyfikacja: pet.identyfikacja, numer_id: pet.numer_id, notatki: pet.notatki, tagi: pet.tagi }} weight={weights[0] ? { kg: weights[0].kg, measured_on: weights[0].measured_on } : null} reports={reports.map(r => ({ id: r.id, title: r.title, test_date: r.test_date, laboratory: r.laboratory }))} keyParameters={keyParameters} readOnly={isReadOnly} />
  </aside></div>
    <HouseholdSchedule pets={[{ id: pet.id, imie: pet.imie }]} householdId={pet.gospodarstwo_id} initialScheduleItems={scheduleItems} initialHealthEvents={healthEvents} initialReports={reports.map(r => ({ id: r.id, pet_id: pet.id, title: r.title, test_date: r.test_date, laboratory: r.laboratory, doctor: r.doctor }))} initialMedicationSchedules={medicationSchedules} initialMedicationLogs={medicationLogs} initialNotificationSettings={notificationSettings} fixedPetId={pet.id} memberNames={memberNames} currentUserId={currentUserId} readOnly={isReadOnly} />
    </RecordSections>
    </PetQuickAddProvider>
  </Container>;
}
