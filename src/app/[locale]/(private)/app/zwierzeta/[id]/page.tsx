import {listWeights} from "@/features/weight/data";
import {WeightPanel} from "@/features/weight/weight-panel";
import {listHealthEvents} from "@/features/history/data";
import {HistoryPanel} from "@/features/history/history-panel";
import {listAssistantThreads, listAssistantMessages, getAssistantQuotaUsed} from "@/features/assistant/data";
import {AssistantPanel} from "@/features/assistant/assistant-panel";
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
export default async function PetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{tab?:string;report?:string;document?:string}> }) {
  const locale = await getLocale();
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  const pet = await getPet((await params).id);
  if (!pet) notFound();
  const resolvedSearch = await searchParams;
  const requestedReport = resolvedSearch.report ?? resolvedSearch.document;
  const [reports,weights,healthEvents,assistantThreads,assistantMessages,assistantQuotaUsed] = await Promise.all([listReports(pet.id,requestedReport),listWeights(pet.id),listHealthEvents(pet.id),listAssistantThreads(pet.id),listAssistantMessages(pet.id),getAssistantQuotaUsed()]);
  const keyParameters=reports.flatMap(report=>report.rows.filter(row=>row.is_key).map(row=>({row,date:report.test_date})));
  const tab = resolvedSearch.tab;
  const initialTab = tab === "history" ? 1 : tab === "results" ? 2 : tab === "documents" || (!tab && resolvedSearch.document) ? 3 : tab === "weight" ? 4 : tab === "assistant" ? 5 : 0;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
  const nextDueEvent = [...healthEvents]
    .filter(ev => ev.next_due_date && ev.next_due_date >= todayIso)
    .sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!))[0];
  const latestCareEvent = healthEvents.find(ev => ev.category === "vaccination" || ev.category === "prevention");
  const facts = [
    [t.rasa, pet.rasa ?? t.missing],
    [t.data_urodzenia, pet.data_urodzenia ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(pet.data_urodzenia)) + (pet.data_urodzenia_przyblizona ? (locale === "pl" ? " (data przybliżona)" : " (approximate date)") : "") : t.unknown],
    [t.plec, t[pet.plec]], [t.kastracja, pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no],
    [t.identyfikacja, t[pet.identyfikacja]], ...(pet.numer_id ? [[t.numer_id, pet.numer_id]] : []),
  ];
  return <Container className="pets-page household-record"><div className="household-record-toolbar"><Link href="/app">← {t.back}</Link><ButtonLink size="sm" variant="secondary" href={`/app/zwierzeta/${pet.id}/edytuj`}>{t.edit}</ButtonLink></div>
    <section className="household-cover">
      <Image src={assets.lunaCover} alt="" fill sizes="(min-width: 1280px) 1184px, 100vw" className="household-cover-image" preload />
      <div className="household-cover-top"><span>{t.profile}</span><small>{locale === "pl" ? "Ostatnia aktualizacja: " : "Last updated: "}{new Intl.DateTimeFormat(locale, {dateStyle:"medium"}).format(new Date(pet.updated_at))}</small></div>
      <div className="household-profile-glass"><div className="household-profile-identity"><div className="household-portrait"><PetIcon species={pet.gatunek} src={pet.avatar_url} name={pet.imie} />{!pet.avatar_url && <small>{d.noPhoto}</small>}</div><div className="household-profile-details"><div className="household-profile-name"><h1>{pet.imie}</h1><span className="household-tag">{t[pet.gatunek]}</span></div><p>{pet.rasa || t.missing} · {t[pet.plec]}</p><div className="household-profile-tags"><span className="household-tag">{t.kastracja}: {pet.kastracja == null ? t.unknown : pet.kastracja ? t.yes : t.no}</span><span className="household-tag">{pet.identyfikacja === "none" || pet.identyfikacja === "unknown" ? `${t.identyfikacja}: ${t[pet.identyfikacja].toLocaleLowerCase(locale)}` : t[pet.identyfikacja]}{pet.numer_id ? `: ${pet.numer_id}` : ""}</span></div></div></div><div className="household-guardian-note"><IconHeart size={20} aria-hidden="true" /><div><strong>{t.notatki}</strong><p className="pet-notes">{pet.notatki || t.noNotes}</p></div></div></div>
    </section>
    <RecordSections key={`${initialTab}-${requestedReport ?? ""}`} initialTab={initialTab} history={<HistoryPanel petId={pet.id} householdId={pet.gospodarstwo_id} petName={pet.imie} initialEvents={healthEvents} reports={reports}/>} weight={<WeightPanel petId={pet.id} petName={pet.imie} measurements={weights}/>} results={<MedicalResults key={ resolvedSearch.report } petId={pet.id} reports={reports} initialReportId={resolvedSearch.report}/>} documents={<MedicalDocuments key={resolvedSearch.document} petId={pet.id} reports={reports} healthEvents={healthEvents} initialDocumentId={resolvedSearch.document}/>} assistant={<AssistantPanel petId={pet.id} petName={pet.imie} initialThreads={assistantThreads} initialMessages={assistantMessages} initialQuotaUsed={assistantQuotaUsed}/>}><div className="household-record-stats">{[
      { label: d.nextVisit, icon: IconCalendar, value: nextDueEvent ? nextDueEvent.next_due_date! : "—", sub: nextDueEvent ? nextDueEvent.title : (locale === "pl" ? "Brak zaplanowanych terminów" : "No upcoming due dates") },
      { label: d.weight, icon: IconScale, value: weights[0] ? `${new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(weights[0].kg)} kg` : "—", sub: weights[0] ? weights[0].measured_on : (locale === "pl" ? "Brak pomiarów" : "No measurements") },
      { label: d.latest, icon: IconFlask, value: reports[0] ? reports[0].test_date : "—", sub: reports[0] ? reports[0].title : d.noResults },
      { label: d.care, icon: IconHeart, value: latestCareEvent ? latestCareEvent.event_date : "—", sub: latestCareEvent ? latestCareEvent.title : (locale === "pl" ? "Brak wpisów profilaktyki" : "No prevention entries") },
    ].map(({ label, icon: Icon, value, sub }) => <section key={label}><Icon size={22} aria-hidden="true" /><h2>{label}</h2><strong>{value}</strong><p>{sub}</p></section>)}</div>
    {keyParameters.length>0&&<section className="pet-panel"><h2>{locale==="pl"?"Kluczowe parametry":"Key parameters"}</h2><dl className="pet-facts">{keyParameters.map(({row,date})=><div key={row.id}><dt>{row.name} · {date}</dt><dd><strong>{row.value} {row.unit}</strong>{row.note&&<p className="pet-notes">{row.note}</p>}</dd></div>)}</dl></section>}
    <div className="household-record-columns"><div>
      <section className="pet-panel household-summary-reports"><h2>{d.events}</h2>
        {healthEvents.length ? <ul>{healthEvents.slice(0,5).map(ev=>{
          const EvIcon = ev.category === "vaccination" ? IconVaccine : ev.category === "prevention" ? IconPill : IconStethoscope;
          return <li key={ev.id}>
            <Link href={`/app/zwierzeta/${pet.id}?tab=history`}><EvIcon size={20} aria-hidden="true"/><span><strong>{ev.title}</strong><small><time dateTime={ev.event_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(ev.event_date))}</time>{ev.clinic&&` · ${ev.clinic}`}</small></span><span aria-hidden="true">→</span></Link>
          </li>;
        })}</ul> : <div className="household-inline-empty"><IconHistory size={26} aria-hidden="true" /><p>{d.noEvents}</p></div>}
        <Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=history`}>{locale==='pl'?'Zobacz oś czasu historii zdrowia →':'View health history timeline →'}</Link>
      </section>
      <section className="pet-panel household-summary-reports"><h2>{d.latest}</h2>
        {reports.length ? <ul>{reports.slice(0,5).map(report=><li key={report.id}>
          <Link href={`/app/zwierzeta/${pet.id}?tab=results&report=${report.id}`}><IconFlask size={20} aria-hidden="true"/><span><strong>{report.title}</strong><small><time dateTime={report.test_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(report.test_date))}</time>{report.laboratory&&` · ${report.laboratory}`}</small></span><span aria-hidden="true">→</span></Link>
        </li>)}</ul> : <p>{d.noResults}</p>}
        <Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=results`}>{locale==='pl'?'Zobacz wszystkie badania →':'View all reports →'}</Link>
      </section>
    </div><aside><section className="pet-panel"><h2>{t.basics}</h2><dl className="pet-facts">
      {facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      <div className="household-summary-weight"><dt>{d.weight}</dt><dd>{weights[0]?<><strong>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(weights[0].kg)} kg</strong><small className="household-summary-weight-date"><time dateTime={weights[0].measured_on}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(weights[0].measured_on))}</time></small></>:(locale==='pl'?'Brak pomiarów':'No measurements')}<Link className="household-summary-link" href={`/app/zwierzeta/${pet.id}?tab=weight`}>{locale==='pl'?'Waga i rozwój →':'Weight and growth →'}</Link></dd></div>
    </dl></section></aside></div></RecordSections>
  </Container>;
}
