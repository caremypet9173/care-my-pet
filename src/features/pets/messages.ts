import type { Locale } from "@/i18n/types";
const pl = {
  home: "Twój dom", title: "Twoje zwierzaki i domowa opieka zdrowotna", intro: "Zarządzaj kartotekami medycznymi, terminami badań i dokumentacją stada w jednym miejscu.",
  add: "Dodaj pupila", edit: "Edytuj profil", back: "Wszystkie zwierzaki", empty: "Poznajmy Twojego pierwszego pupila",
  emptyBody: "Dodaj kota lub psa, aby stworzyć jego własny profil.", profile: "Profil pupila", basics: "Podstawowe informacje",
  imie: "Imię", gatunek: "Gatunek", rasa: "Rasa", data_urodzenia: "Data urodzenia", plec: "Płeć", kastracja: "Kastracja / sterylizacja",
  identyfikacja: "Identyfikacja", numer_id: "Numer identyfikacyjny", notatki: "Notatki opiekuna", cat: "Kot", dog: "Pies",
  female: "Samica", male: "Samiec", unknown: "Nie wiadomo", none: "Brak", chip: "Mikroczip", tattoo: "Tatuaż",
  yes: "Tak", no: "Nie", save: "Zapisz profil", cancel: "Anuluj", optional: "Pola oznaczone * są wymagane. Pozostałe możesz uzupełnić później.",
  chipHint: "Numer mikroczipa składa się z 15 cyfr.", failed: "Nie udało się zapisać profilu. Spróbuj ponownie.",
  invalid: "Sprawdź dane w polu:", conflict: "Profil zmienił się lub nie masz już do niego dostępu. Otwórz go ponownie przed kolejną edycją.",
  loadFailed: "Nie udało się pobrać profili. Odśwież stronę, aby spróbować ponownie.", missing: "Nie uzupełniono", noNotes: "Nie dodano jeszcze notatek.",
};
const en: typeof pl = {
  home: "Your household", title: "Your pets and care at home", intro: "A place for every pet. Start with the basics.",
  add: "Add a pet", edit: "Edit profile", back: "All pets", empty: "Let’s meet your first pet",
  emptyBody: "Add a cat or dog to create their own profile.", profile: "Pet profile", basics: "Basic information",
  imie: "Name", gatunek: "Species", rasa: "Breed", data_urodzenia: "Date of birth", plec: "Sex", kastracja: "Neutered / spayed",
  identyfikacja: "Identification", numer_id: "Identification number", notatki: "Caregiver notes", cat: "Cat", dog: "Dog",
  female: "Female", male: "Male", unknown: "Unknown", none: "None", chip: "Microchip", tattoo: "Tattoo",
  yes: "Yes", no: "No", save: "Save profile", cancel: "Cancel", optional: "Fields marked * are required. You can fill in the rest later.",
  chipHint: "A microchip number contains 15 digits.", failed: "Could not save the profile. Please try again.",
  invalid: "Check this field:", conflict: "This profile has changed or is no longer available to you. Reopen it before editing again.",
  loadFailed: "Could not load profiles. Refresh the page to try again.", missing: "Not provided", noNotes: "No notes yet.",
};
export const petMessages: Record<Locale, typeof pl> = { pl, en };
