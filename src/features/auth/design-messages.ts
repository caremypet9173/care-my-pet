import type { Locale } from "@/i18n/types";
const pl = {
  back: "Wróć do strony głównej", tagline: "Cyfrowa kartoteka zdrowia", badge: "Opieka domowa w jednym miejscu",
  headline: "Spokojna głowa o zdrowie Twoich pupili.", description: "Zacznij od profili swoich zwierząt. Rozwijamy miejsce na historię leczenia, wyniki badań i domową profilaktykę.",
  features: ["Indywidualna kartoteka każdego psa i kota", "Wyniki badań z podglądem oryginalnych dokumentów", "Wspólny kalendarz i przypomnienia — w przygotowaniu"],
  preview: "Zobacz, jak może wyglądać kartoteka pupila", previewText: "Poznaj przykładową historię Luny, jej badania i dokumenty. Demo zawiera fikcyjne dane.", demo: "Zobacz profil Luny",
  welcome: "Witaj z powrotem", loginIntro: "Zaloguj się do kartoteki swoich pupili, aby kontynuować opiekę.", registerIntro: "Załóż konto i stwórz miejsce dla swoich pupili.",
  apple: "Zaloguj przez Apple ID", unavailable: "Niedostępne", show: "Pokaż hasło", hide: "Ukryj hasło", modes: "Logowanie i rejestracja",
};
const en: typeof pl = {
  back: "Back to homepage", tagline: "Digital health record", badge: "Care at home, in one place",
  headline: "Peace of mind about your pets’ health.", description: "Start with your pets’ profiles. We are building a home for medical history, test results and preventive care.",
  features: ["An individual record for every cat and dog", "Test results with original document previews", "Shared calendar and reminders — coming later"],
  preview: "See what your pet’s record could look like", previewText: "Explore Luna’s sample history, tests and documents. The demo contains fictional data.", demo: "View Luna’s profile",
  welcome: "Welcome back", loginIntro: "Sign in to your pets’ records to continue their care.", registerIntro: "Create an account and a home for your pets’ records.",
  apple: "Sign in with Apple ID", unavailable: "Unavailable", show: "Show password", hide: "Hide password", modes: "Sign in and registration",
};
export const authDesignMessages: Record<Locale, typeof pl> = { pl, en };
