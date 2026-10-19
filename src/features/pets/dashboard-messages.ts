import type { Locale } from "@/i18n/types";
const pl = {
  dashboard: "Pulpit domowy", records: "Aktywne kartoteki", profiles: "Profile podopiecznych w domostwie",
  results: "Wyniki badań", vaccinations: "Szczepienia", nextVisit: "Najbliższy termin", noData: "Brak danych",
  upcoming: "W przygotowaniu", upload: "Wgraj dokument medyczny", record: "Otwórz kartotekę", nextPet: "Dodaj kolejnego pupila",
  addHint: "Prowadź historię leczenia, szczepień i badań dla psa, drugiego kota lub całej swojej domowej gromadki.",
  medicalEmpty: "Dokumentacja medyczna czeka na uzupełnienie", medicalHint: "Historia badań i wizyt pojawi się tutaj po uruchomieniu dokumentacji.",
  lastVisit: "Ostatnia wizyta", prevention: "Najbliższa profilaktyka", clinic: "Placówka", calendar: "Wspólny terminarz i przypomnienia domowe",
  calendarHint: "Zdarzenia ze wszystkich kartotek w jednym miejscu.", calendarEmpty: "Tutaj pojawią się wizyty i przypomnienia",
  calendarBody: "Obsługę terminów przygotowujemy. Na razie możesz uzupełnić profile swoich zwierząt.",
  note: "Kartoteki są dostępne w Twoim gospodarstwie. Informacje o zdrowiu uzupełniaj na podstawie dokumentacji weterynaryjnej.",
  summary: "Podsumowanie", history: "Historia", documents: "Dokumenty", weight: "Aktualna waga", latest: "Ostatnie badania", care: "Karmy i leki",
  events: "Ostatnie wydarzenia", noEvents: "Historia wizyt i zabiegów nie jest jeszcze dostępna.",
  noResults: "Dodawanie i przeglądanie wyników badań jest w przygotowaniu.", noDocuments: "Przesyłanie dokumentów medycznych jest w przygotowaniu.",
  weightHint: "Pomiary masy ciała pojawią się w kolejnym etapie.", noPhoto: "Brak zdjęcia", recordLabel: "Cyfrowa kartoteka zdrowia",
};
const en: typeof pl = {
  dashboard: "Household dashboard", records: "Active records", profiles: "Pets in your household",
  results: "Lab results", vaccinations: "Vaccinations", nextVisit: "Next appointment", noData: "No data",
  upcoming: "Coming later", upload: "Upload a medical document", record: "Open record", nextPet: "Add another pet",
  addHint: "Keep a care record for your dog, another cat, or your whole household of pets.",
  medicalEmpty: "Medical records are waiting to be filled in", medicalHint: "Tests and visits will appear here when medical records become available.",
  lastVisit: "Last visit", prevention: "Next preventive care", clinic: "Clinic", calendar: "Shared calendar and household reminders",
  calendarHint: "Events from all your pet records in one place.", calendarEmpty: "Appointments and reminders will appear here",
  calendarBody: "Scheduling is in preparation. For now, you can fill in your pets’ profiles.",
  note: "Records are available within your household. Use veterinary documents when adding health information.",
  summary: "Summary", history: "History", documents: "Documents", weight: "Current weight", latest: "Latest tests", care: "Food and medication",
  events: "Recent events", noEvents: "Visit and procedure history is not available yet.",
  noResults: "Adding and reviewing lab results is in preparation.", noDocuments: "Medical document uploads are in preparation.",
  weightHint: "Weight measurements will be available in a later stage.", noPhoto: "No photo", recordLabel: "Digital health record",
};
export const dashboardMessages: Record<Locale, typeof pl> = { pl, en };
