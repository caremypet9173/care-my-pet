import {listWeights} from "@/features/weight/data";
import {WeightPanel} from "@/features/weight/weight-panel";
import {listHealthEvents} from "@/features/history/data";
import {HistoryPanel} from "@/features/history/history-panel";
import {getHouseholdNotificationSettings, listPetScheduleItems} from "@/features/schedule/data";
import {HouseholdSchedule} from "@/features/schedule/household-schedule";
import {listPetMedicationLogs, listPetMedicationSchedules} from "@/features/medications/data";
import {listAssistantThreads, listAssistantMessages, getAssistantQuotaUsed} from "@/features/assistant/data";
import {AssistantPanel} from "@/features/assistant/assistant-panel";
import {ShareRecordButton} from "@/features/share/share-record-dialog";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPet } from "@/features/pets/data";
import { PetIcon } from "@/features/pets/pet-icon";
import { petMessages } from "@/features/pets/messages";
import { dashboardMessages } from "@/features/pets/dashboard-messages";
import { RecordSections } from "@/features/pets/record-sections";
import { IconCalendar, IconScale, IconFlask, IconHeart, IconHistory, IconStethoscope, IconVaccine, IconPill } from "@tabler/icons-react";
import Image from "next/image";
import { assets } from "@/lib/assets";
import "@/styles/pets.css";
import "@/styles/medical.css";
import "@/styles/medical-profile.css";
import { listReports } from "@/features/medical/data";
import { MedicalResults } from "@/features/medical/results";
import { MedicalDocuments } from "@/features/medical/documents";
import { DischargeImportButton } from "@/features/medical/discharge-import-button";
import { ActiveMedicationsCard } from "@/features/medications/active-medications-card";
import { getHouseholdDetails } from "@/features/household/data";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const pet = await getPet(id);
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

export default async function PetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{tab?:string;report?:string;document?:string}> }) {
  const locale = await getLocale();
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const pet = await getPet((await params).id);
  if (!pet) notFound();
  const resolvedSearch = await searchParams;
  const requestedReport = resolvedSearch.report ?? resolvedSearch.document;
  const tab = resolvedSearch.tab;
  const initialTab = tab === "history" ? 1 : tab === "results" ? 2 : tab === "documents" || (!tab && resolvedSearch.document) ? 3 : tab === "weight" ? 4 : tab === "assistant" ? 5 : 0;
  const isAssistantTab = initialTab === 5;
  const isMedicalTab = initialTab === 2 || initialTab === 3 || !!requestedReport;
  const [reports,weights,healthEvents,scheduleItems,notificationSettings,assistantThreads,assistantMessages,assistantQuotaUsed,medicationSchedules,medicationLogs,householdDetails] = await Promise.all([
    listReports(pet.id, requestedReport, { full: isMedicalTab }),
    listWeights(pet.id),
    listHealthEvents(pet.id),
    listPetScheduleItems(pet.id),
    getHouseholdNotificationSettings(),
    isAssistantTab ? listAssistantThreads(pet.id) : Promise.resolve(undefined),
    isAssistantTab ? listAssistantMessages(pet.id) : Promise.resolve(undefined),
    isAssistantTab ? getAssistantQuotaUsed() : Promise.resolve(undefined),
    listPetMedicationSchedules(pet.id),
    listPetMedicationLogs(pet.id),
    getHouseholdDetails(pet.gospodarstwo_id)
  ]);
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
    [t.plec, t[pet.plec]], [t.kastracja, pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no],
    [t.identyfikacja, t[pet.identyfikacja]], ...(pet.numer_id ? [[t.numer_id, pet.numer_id]] : []),
  ];
  return <Container className="pets-page household-record"><div className="household-record-toolbar"><Link href="/app">← {t.back}</Link><div className="household-record-toolbar-actions"><DischargeImportButton pet={pet} householdId={pet.gospodarstwo_id} /><ShareRecordButton petId={pet.id} petName={pet.imie} /><ButtonLink size="sm" variant="secondary" href={`/app/zwierzeta/${pet.id}/edytuj`}>{t.edit}</ButtonLink></div></div>
    <section className="household-cover">
      <Image src={assets.lunaCover} alt="" fill sizes="(min-width: 1280px) 1184px, 100vw" className="household-cover-image" preload />
      <div className="household-cover-top"><span>{t.profile}</span><small>{locale === "pl" ? "Ostatnia aktualizacja: " : "Last updated: "}{new Intl.DateTimeFormat(locale, {dateStyle:"medium"}).format(new Date(pet.updated_at))}</small></div>
      <div className="household-profile-glass"><div className="household-profile-identity"><div className="household-portrait"><PetIcon species={pet.gatunek} src={pet.avatar_url} name={pet.imie} />{!pet.avatar_url && <small>{d.noPhoto}</small>}</div><div className="household-profile-details"><div className="household-profile-name"><h1>{pet.imie}</h1><span className="household-tag">{t[pet.gatunek]}</span></div><p>{pet.rasa || t.missing} · {t[pet.plec]}</p><div className="household-profile-tags"><span className="household-tag">{t.kastracja}: {pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no}</span><span className="household-tag">{pet.identyfikacja === "none" || pet.identyfikacja === "unknown" ? `${t.identyfikacja}: ${t[pet.identyfikacja].toLocaleLowerCase(locale)}` : t[pet.identyfikacja]}{pet.numer_id ? `: ${pet.numer_id}` : ""}</span></div></div></div><div className="household-guardian-note"><IconHeart size={20} aria-hidden="true" /><div><strong>{t.notatki}</strong><p className="pet-notes">{pet.notatki || t.noNotes}</p></div></div></div>
    </section>
    <RecordSections key={`${initialTab}-${requestedReport ?? ""}`} initialTab={initialTab} history={<HistoryPanel petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} initialEvents={healthEvents} reports={reports}/>} weight={<WeightPanel petId={pet.id} petName={pet.imie} measurements={weights}/>} results={<MedicalResults key={ resolvedSearch.report } petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} reports={reports} initialReportId={resolvedSearch.report}/>} documents={<MedicalDocuments key={resolvedSearch.document} petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} reports={reports} healthEvents={healthEvents} initialDocumentId={resolvedSearch.document}/>} assistant={<AssistantPanel petId={pet.id} petName={pet.imie} initialThreads={assistantThreads} initialMessages={assistantMessages} initialQuotaUsed={assistantQuotaUsed}/>}><div className="household-record-stats">{[
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
            <Link href={`/app/zwierzeta/${pet.id}?tab=history`}><EvIcon size={20} aria-hidden="true"/><span><strong>{ev.title}</strong><small><time dateTime={ev.event_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(ev.event_date))}</time>{ev.clinic&&` · ${ev.clinic}`}</small></span><span aria-hidden="true">→</span></Link>
          </li>;
        })}</ul> : <div className="household-inline-empty"><IconHistory size={26} aria-hidden="true" /><p>{d.noEvents}</p></div>}
        <Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=history`}>{locale==='pl'?'Zobacz oś czasu historii zdrowia →':'View health history timeline →'}</Link>
      </section>
      <section className="pet-panel household-summary-reports household-summary-lab"><h2>{d.latest}</h2>
        {reports.length ? <ul>{reports.slice(0,5).map(report=><li key={report.id}>
          <Link href={`/app/zwierzeta/${pet.id}?tab=results&report=${report.id}`}><IconFlask size={20} aria-hidden="true"/><span><strong>{report.title}</strong><small><time dateTime={report.test_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(report.test_date))}</time>{report.laboratory&&` · ${report.laboratory}`}</small></span><span aria-hidden="true">→</span></Link>
        </li>)}</ul> : <p>{d.noResults}</p>}
        <Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=results`}>{locale==='pl'?'Zobacz wszystkie badania →':'View all reports →'}</Link>
      </section>
    </div><aside><section className="pet-panel household-summary-basics"><h2>{t.basics}</h2><dl className="pet-facts">
      {facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div className="household-summary-weight"><dt>{d.weight}</dt><dd>{weights[0]?<><strong>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(weights[0].kg)} kg</strong><small className="household-summary-weight-date"><time dateTime={weights[0].measured_on}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(weights[0].measured_on))}</time></small></>:(locale==='pl'?'Brak pomiarów':'No measurements')}<Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=weight`}>{locale==='pl'?'Waga i rozwój →':'Weight and growth →'}</Link></dd></div>
    </dl></section>
    <ActiveMedicationsCard petId={pet.id} petName={pet.imie} initialSchedules={medicationSchedules} initialLogs={medicationLogs} memberNames={memberNames} currentUserId={currentUserId} pets={[{ id: pet.id, imie: pet.imie }]} petData={{ id: pet.id, imie: pet.imie, gatunek: pet.gatunek, rasa: pet.rasa, data_urodzenia: pet.data_urodzenia, data_urodzenia_przyblizona: pet.data_urodzenia_przyblizona, plec: pet.plec, kastracja: pet.kastracja, identyfikacja: pet.identyfikacja, numer_id: pet.numer_id, notatki: pet.notatki }} weight={weights[0] ? { kg: weights[0].kg, measured_on: weights[0].measured_on } : null} reports={reports.map(r => ({ id: r.id, title: r.title, test_date: r.test_date, laboratory: r.laboratory }))} keyParameters={keyParameters} />
  </aside></div>
    <HouseholdSchedule pets={[{ id: pet.id, imie: pet.imie }]} initialScheduleItems={scheduleItems} initialHealthEvents={healthEvents} initialReports={reports.map(r => ({ id: r.id, pet_id: pet.id, title: r.title, test_date: r.test_date, laboratory: r.laboratory, doctor: r.doctor }))} initialMedicationSchedules={medicationSchedules} initialMedicationLogs={medicationLogs} initialNotificationSettings={notificationSettings} fixedPetId={pet.id} memberNames={memberNames} currentUserId={currentUserId} />
    </RecordSections>
  </Container>;
}
