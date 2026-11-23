import type { Locale } from "@/i18n/types";
import type { ArchiveReason } from "./types";

const pl = {
  sectionTitle: "Zamknięcie kartoteki",
  sectionHint:
    "Kartoteka przestanie pojawiać się na aktywnym pulpicie, zatrzymamy aktywne harmonogramy leków, anulujemy zaplanowane wizyty oraz unieważnimy aktywne linki dla weterynarza. Pełna historia badań pozostanie dostępna do odczytu i będzie można ją w każdej chwili przywrócić.",
  closeButton: "Zamknij kartotekę",
  dialogTitle: "Zamknąć kartotekę pupila?",
  dialogSubtitle:
    "To działanie jest odwracalne — nic nie zostanie trwale usunięte. Zachowasz dostęp do historii badań, pomiarów i Asystenta AI.",
  reasonLabel: "Powód zamknięcia kartoteki",
  reasons: {
    deceased: {
      label: "Pupil odszedł",
      description: "Kartoteka przejdzie w stonowany tryb pamięci.",
    },
    rehomed: {
      label: "Zmiana opiekuna",
      description: "Pupil ma nowego opiekuna i nie wymaga już codziennej opieki w tym domu.",
    },
    other: {
      label: "Inny powód",
      description: "Czasowe lub stałe zawieszenie prowadzenia kartoteki.",
    },
  } as Record<ArchiveReason, { label: string; description: string }>,
  closedOnLabel: "Data pożegnania (opcjonalnie)",
  closedOnHint: "Pozwala wyświetlić datę w nagłówku pamięci, np. lata życia.",
  noteLabel: "Notatka zamykająca (opcjonalnie)",
  notePlaceholder: "Np. krótkie wspomnienie, podsumowanie lub kontakt do nowego opiekuna…",
  effectsTitle: "Co zmieni zamknięcie:",
  effects: [
    "Aktywne harmonogramy leków zostaną wyciszone, a zaplanowane wizyty anulowane.",
    "Wszystkie aktywne linki udostępniania dla weterynarza zostaną automatycznie unieważnione.",
    "Przypomnienia e-mail i powiadomienia push dla tego pupila przestaną być wysyłane.",
    "Kartoteka stanie się tylko do odczytu; właściciel może ją przywrócić w dowolnym momencie.",
  ],
  cancel: "Anuluj",
  confirmClose: "Potwierdzam i zamykam kartotekę",
  closing: "Zamykanie kartoteki…",
  restoreButton: "Przywróć kartotekę",
  restoring: "Przywracanie…",
  restoreConfirmTitle: "Przywrócić kartotekę do aktywnych?",
  restoreConfirmBody:
    "Kartoteka ponownie będzie aktywna i edytowalna. Wyciszone wcześniej harmonogramy leków, odwołane wizyty i linki udostępniania pozostaną wyłączone, dopóki nie włączysz ich ręcznie.",
  restoreConfirmAction: "Tak, przywróć kartotekę",
  heroBadgeDeceased: "W pamięci",
  heroBadgeClosed: "Kartoteka zamknięta",
  closedOnFact: "Data pożegnania",
  reasonFact: "Powód zamknięcia",
  bannerTitleDeceased: "Kartoteka pamięci (tylko do odczytu)",
  bannerTitleClosed: "Kartoteka zamknięta (tylko do odczytu)",
  bannerBodyOwner:
    "Dane medyczne są zabezpieczone przed zmianami. Możesz nadal przeglądać historię, pytać Asystenta AI lub przywrócić kartotekę.",
  bannerBodyMember:
    "Dane medyczne są zablokowane do edycji. Kartotekę może przywrócić wyłącznie właściciel gospodarstwa.",
  dashboardArchivedTitle: "Zamknięte kartoteki",
  dashboardArchivedEmptyHint: "Brak zamkniętych kartotek.",
  dashboardOpenArchived: "Zobacz historię",
  subpageBlockedTitle: "Kartoteka jest zamknięta",
  subpageBlockedBody:
    "Nie można dodawać ani edytować wpisów w zamkniętej kartotece. Aby wprowadzić zmiany, najpierw przywróć ją do aktywnych.",
  backToRecord: "Wróć do kartoteki",
  errors: {
    closed_on: "Podaj poprawną datę pożegnania (nie starszą niż data urodzenia i nie z przyszłości).",
    archive_reason: "Wybierz powód zamknięcia kartoteki.",
    archive_note: "Notatka może mieć maksymalnie 1000 znaków.",
    forbidden: "Tylko właściciel gospodarstwa może zamknąć lub przywrócić kartotekę.",
    pet_archived: "Ta kartoteka jest już zamknięta i zabezpieczona przed edycją.",
    recovery_key_required:
      "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu).",
    generic: "Nie udało się zapisać zmiany statusu kartoteki.",
  },
};

const en: typeof pl = {
  sectionTitle: "Close pet record",
  sectionHint:
    "The record will leave the active dashboard, active medication schedules will be paused, planned visits cancelled, and active veterinary share links revoked. Full medical history remains readable and can be restored anytime.",
  closeButton: "Close record",
  dialogTitle: "Close pet record?",
  dialogSubtitle:
    "This action is reversible — nothing is permanently deleted. You will keep access to lab results, measurements, and the AI Assistant.",
  reasonLabel: "Reason for closing record",
  reasons: {
    deceased: {
      label: "Pet passed away",
      description: "Switches the record to a gentle memorial mode.",
    },
    rehomed: {
      label: "Rehomed",
      description: "The pet has a new caregiver and no longer needs daily tracking here.",
    },
    other: {
      label: "Other reason",
      description: "Temporarily or permanently pause tracking this record.",
    },
  },
  closedOnLabel: "Date of passing (optional)",
  closedOnHint: "Used to display years of life or the date in the memorial header.",
  noteLabel: "Closing note (optional)",
  notePlaceholder: "E.g., a short memory, summary, or new caregiver contact…",
  effectsTitle: "What closing changes:",
  effects: [
    "Active medication schedules are paused and planned schedule items are cancelled.",
    "All active veterinary share links are automatically revoked.",
    "Email digests and push notifications stop for this pet.",
    "The record becomes read-only; the household owner can restore it anytime.",
  ],
  cancel: "Cancel",
  confirmClose: "Confirm and close record",
  closing: "Closing record…",
  restoreButton: "Restore record",
  restoring: "Restoring…",
  restoreConfirmTitle: "Restore record to active?",
  restoreConfirmBody:
    "The record will become active and editable again. Previously paused medication schedules, cancelled visits, and revoked share links remain off until re-enabled manually.",
  restoreConfirmAction: "Yes, restore record",
  heroBadgeDeceased: "In loving memory",
  heroBadgeClosed: "Record closed",
  closedOnFact: "Date of passing",
  reasonFact: "Closure reason",
  bannerTitleDeceased: "Memorial record (read-only)",
  bannerTitleClosed: "Closed record (read-only)",
  bannerBodyOwner:
    "Medical data is locked against edits. You can still browse history, ask the AI Assistant, or restore the record.",
  bannerBodyMember:
    "Medical data is locked against edits. Only the household owner can restore this record.",
  dashboardArchivedTitle: "Closed records",
  dashboardArchivedEmptyHint: "No closed records.",
  dashboardOpenArchived: "View history",
  subpageBlockedTitle: "Record is closed",
  subpageBlockedBody:
    "New entries and edits are disabled for closed records. Restore the record first to make changes.",
  backToRecord: "Back to record",
  errors: {
    closed_on: "Enter a valid date (not before birth date and not in the future).",
    archive_reason: "Select a reason for closing the record.",
    archive_note: "Note can be at most 1000 characters.",
    forbidden: "Only the household owner can close or restore pet records.",
    pet_archived: "This record is closed and read-only.",
    recovery_key_required:
      "This household requires a recovery key before making changes (read-only mode).",
    generic: "Could not update the record status.",
  },
};

export const petArchiveMessages: Record<Locale, typeof pl> = { pl, en };
