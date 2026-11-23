import Image from "next/image";
import { IconCalendar, IconFiles, IconCircleCheck, IconUpload, IconClock, IconUsers, IconPlus, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { RecoveryKeyActionButton } from "@/features/household/recovery-banner";
import { Link } from "@/i18n/navigation";
import { assets } from "@/lib/assets";
import type { Locale } from "@/i18n/types";

export interface EmptyHouseholdRecoveryLock {
  householdId?: string;
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  isOwner: boolean;
}

const pl = {
  zero: "0 aktywnych kartotek", add: "Dodaj profil psa lub kota", alerts: "Brak aktywnych alertów", alertsHint: "Wskaźniki pojawią się po badaniach",
  prevention: "Kalendarz profilaktyki", preventionHint: "Szczepienia i odrobaczanie na osi czasu", documents: "Dokumentacja", documentsHint: "Wypisy i wyniki w jednym miejscu",
  profiles: "Profile podopiecznych w domostwie", count: "0 przypisanych zwierząt", start: "Początek opieki w domostwie",
  title: "Twoje domostwo nie ma jeszcze żadnego podopiecznego",
  intro: "Zarejestruj pierwszego psa lub kota i utwórz dla niego indywidualną kartotekę. W kolejnych etapach dodasz wyniki badań z kliniki i przypomnienia o szczepieniach.",
  create: "Utwórz kartotekę pupila", demo: "Zobacz demonstracyjny profil Luny",
  unlockKey: "Wygeneruj klucz i odblokuj dodawanie pupila",
  recoveryHintOwner: "Krok 1 z 2: Zanim dodasz pierwszego pupila, wygeneruj jednorazowy klucz odzyskania dostępu. Odblokuje to od razu tworzenie kartotek.",
  recoveryHintMember: "Właściciel domostwa musi najpierw wygenerować klucz odzyskania dostępu, aby odblokować dodawanie kartotek.",
  timeline: "Dedykowana oś czasu", timelineHint: "Chronologia wizyt, podanych leków oraz zaleceń lekarskich.",
  analysis: "Automatyczny odczyt badań", analysisHint: "Odczyt plików PDF i zdjęć wypisów weterynaryjnych.",
  sharing: "Wspólna opieka", sharingHint: "Łatwy dostęp i harmonogram dla domowników oraz petsittera.",
  planned: "W przygotowaniu", calendar: "Wspólny terminarz i przypomnienia domowe", herd: "Stado",
  calendarHint: "Zbiorcze zestawienie najbliższych wizyt, leków i badań dla wszystkich zwierząt.", plan: "Zaplanuj przypomnienie",
  noEvents: "Brak nadchodzących terminów i leków do podania",
  noEventsHint: "Po uruchomieniu terminarza w tym miejscu zobaczysz chronologiczny harmonogram leków, wizyt kontrolnych i profilaktyki domowej.",
  note: "Panel domostwa Care My Pet to wspólne miejsce na kartoteki wszystkich Twoich zwierząt. Zacznij od dodania pierwszego pupila.",
};
const en: typeof pl = {
  zero: "0 active records", add: "Add a cat or dog profile", alerts: "No active alerts", alertsHint: "Indicators will appear after tests",
  prevention: "Preventive care calendar", preventionHint: "Vaccinations and deworming on a timeline", documents: "Documents", documentsHint: "Reports and results in one place",
  profiles: "Pets in your household", count: "0 pets added", start: "The start of care at home",
  title: "Your household does not have any pets yet",
  intro: "Register your first cat or dog and create their own record. Later, you will be able to add clinic test results and vaccination reminders.",
  create: "Create a pet record", demo: "View Luna’s demo profile",
  unlockKey: "Generate recovery key & unlock",
  recoveryHintOwner: "Step 1 of 2: Before adding your first pet, generate your one-time recovery key. This immediately unlocks creating pet records.",
  recoveryHintMember: "The household owner must generate a recovery key first to unlock creating pet records.",
  timeline: "Dedicated timeline", timelineHint: "A history of visits, medication and veterinary recommendations.",
  analysis: "Automatic test extraction", analysisHint: "Reading PDFs and photos of veterinary reports.",
  sharing: "Shared care", sharingHint: "Easy access and scheduling for household members and pet sitters.",
  planned: "Coming later", calendar: "Shared calendar and household reminders", herd: "Household",
  calendarHint: "Upcoming visits, medication and tests for all your pets in one place.", plan: "Schedule a reminder",
  noEvents: "No upcoming appointments or medication to give",
  noEventsHint: "Once scheduling is available, this area will show a timeline of medication, check-ups and preventive care.",
  note: "Your Care My Pet household is a shared home for all your pets’ records. Start by adding your first pet.",
};

export function EmptyHousehold({
  locale,
  canAddPet = true,
  recoveryLock = null,
}: {
  locale: Locale;
  canAddPet?: boolean;
  recoveryLock?: EmptyHouseholdRecoveryLock | null;
}) {
  const t = locale === "pl" ? pl : en;
  const stats = [
    { icon: IconFiles, title: t.zero, text: t.add },
    { icon: IconCircleCheck, title: t.alerts, text: t.alertsHint },
    { icon: IconCalendar, title: t.prevention, text: t.preventionHint },
    { icon: IconUpload, title: t.documents, text: t.documentsHint },
  ];
  const features = [
    { icon: IconClock, title: t.timeline, text: t.timelineHint },
    { icon: IconFiles, title: t.analysis, text: t.analysisHint },
    { icon: IconUsers, title: t.sharing, text: t.sharingHint },
  ];
  const needsRecoveryUnlock = !canAddPet && recoveryLock !== null;

  return <div className="empty-household">
    <div className="household-digest">{stats.map(({ icon: Icon, title, text }) => <div key={title}><span className="digest-icon"><Icon size={22} aria-hidden="true" /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
    <div className="household-section-heading"><h2>{t.profiles}</h2><span>{t.count}</span></div>
    <section className="empty-household-welcome" aria-labelledby="empty-household-title"><div className="empty-household-content">
      <div className="empty-household-mark"><Image src={assets.brand} width={48} height={48} alt="" /></div>
      <span className="empty-household-badge">{t.start}</span>
      <h3 id="empty-household-title">{t.title}</h3><p className="empty-household-intro">{t.intro}</p>
      {needsRecoveryUnlock && (
        <p className="empty-household-recovery-note" role="status">
          <IconLock size={16} aria-hidden="true" />
          <span>{recoveryLock.isOwner ? t.recoveryHintOwner : t.recoveryHintMember}</span>
        </p>
      )}
      <div className="empty-household-actions">
        {canAddPet ? (
          <ButtonLink size="sm" href="/app/pets/new"><IconPlus size={16} aria-hidden="true" />{t.create}</ButtonLink>
        ) : needsRecoveryUnlock && recoveryLock.isOwner ? (
          <RecoveryKeyActionButton
            householdId={recoveryLock.householdId}
            householdName={recoveryLock.householdName}
            ownerEmail={recoveryLock.ownerEmail}
            recoveryEmail={recoveryLock.recoveryEmail}
            label={t.unlockKey}
          />
        ) : null}
        <Link href="/demo/luna">{t.demo} →</Link>
      </div>
      <div className="empty-household-features">{features.map(({ icon: Icon, title, text }) => <div key={title}><span><Icon size={17} aria-hidden="true" /></span><h4>{title}</h4><p>{text}</p></div>)}</div>
      <p className="empty-household-planned">{t.planned}</p>
    </div></section>
    <section className="household-calendar empty-household-calendar"><div className="household-section-heading"><div><h2>{t.calendar} <span className="empty-household-badge">{t.herd}</span></h2><p>{t.calendarHint}</p></div><div className="empty-household-plan"><Button size="sm" variant="secondary" disabled><IconPlus size={14} aria-hidden="true" />{t.plan}</Button><small>{t.planned}</small></div></div>
      <div className="empty-household-agenda"><span><IconCalendar size={24} aria-hidden="true" /></span><h3>{t.noEvents}</h3><p>{t.noEventsHint}</p></div>
    </section>
    <p className="household-advisory"><IconInfoCircle size={18} aria-hidden="true" />{t.note}</p>
  </div>;
}
