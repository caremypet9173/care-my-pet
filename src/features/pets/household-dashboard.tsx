import { IconCalendar, IconFiles, IconFlask, IconShieldCheck, IconPlus, IconArrowRight, IconInfoCircle } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import type { Pet } from "./types";
import { PetIcon } from "./pet-icon";
import { petMessages } from "./messages";
import { dashboardMessages } from "./dashboard-messages";
import { EmptyHousehold } from "./empty-household";

export function HouseholdDashboard({ pets, locale }: { pets: Pet[]; locale: Locale }) {
  const t = petMessages[locale];
  const d = dashboardMessages[locale];
  if (pets.length === 0) return <EmptyHousehold locale={locale} />;
  const stats = [
    { icon: IconFiles, title: `${pets.length} · ${d.records}`, text: pets.map(pet => pet.imie).join(", ") || t.emptyBody },
    { icon: IconFlask, title: d.results, text: `${pets.reduce((sum,pet)=>sum+(pet.report_count??0),0)}` },
    { icon: IconShieldCheck, title: d.vaccinations, text: d.upcoming },
    { icon: IconCalendar, title: d.nextVisit, text: d.upcoming },
  ];
  return <>
    <section className="household-digest" aria-label={d.summary}>{stats.map(({ icon: Icon, title, text }) => <div key={title}><span className="digest-icon"><Icon size={22} aria-hidden="true" /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</section>
    <div className="household-section-heading"><h2>{d.profiles}</h2><span>{pets.length} · {d.records}</span></div>
    <div className="pets-grid">
      {pets.map(pet => <article className="pet-card" key={pet.id}>
        <div className="household-card-identity"><PetIcon species={pet.gatunek} src={pet.avatar_url} name={pet.imie} /><div><h3>{pet.imie} <span className="household-tag">{t[pet.gatunek]}</span></h3><p>{pet.rasa || t.missing} · {t[pet.plec]}</p><span className="household-tag">{pet.kastracja == null ? `${t.kastracja}: ${t.unknown}` : `${t.kastracja}: ${pet.kastracja ? t.yes : t.no}`}</span></div></div>
        <div className="household-card-notice"><IconFiles size={18} aria-hidden="true" /><div><strong>{pet.report_count ? `${d.results}: ${pet.report_count}` : d.medicalEmpty}</strong><p>{locale === "pl" ? "Dodawaj i przeglądaj badania w kartotece pupila." : "Add and review reports in your pet’s record."}</p></div></div>
        <dl className="household-card-facts">{[d.lastVisit, d.prevention, d.clinic].map(label => <div key={label}><dt>{label}</dt><dd>—</dd></div>)}</dl>
        <Link className="button button--primary button--sm household-card-link" href={`/app/zwierzeta/${pet.id}`}>{d.record} <span className="sr-only">{pet.imie}</span><IconArrowRight size={16} aria-hidden="true" /></Link>
      </article>)}
      <Link className="pet-card pet-card--add" href="/app/zwierzeta/nowe"><span className="add-pet-icon"><IconPlus size={26} aria-hidden="true" /></span><h3>{pets.length ? d.nextPet : t.empty}</h3><p>{d.addHint}</p><span className="household-add-label">+ {t.add}</span></Link>
    </div>
    <section className="household-calendar"><div className="household-section-heading"><div><h2>{d.calendar}</h2><p>{d.calendarHint}</p></div><span className="household-tag">{d.upcoming}</span></div><div className="household-calendar-empty"><IconCalendar size={30} stroke={1.4} aria-hidden="true" /><div><h3>{d.calendarEmpty}</h3><p>{d.calendarBody}</p></div></div></section>
    <p className="household-advisory"><IconInfoCircle size={18} aria-hidden="true" />{d.note}</p>
  </>;
}
