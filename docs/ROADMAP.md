# ROADMAP

**Wersja:** 0.3 (cichy pilotaż)
**Data:** 2026-09-28
**Powiązane:** PRD.md, TECH.md, HOSTING.md, MONETIZATION.md

## Punkt wyjścia

Decyzja 2026-10-14: aplikację budujemy od nowa. Stare PoC potwierdziły
użyteczność Gemini w Supabase Edge Functions i wykorzystanie pgvector do
ograniczania kontekstu asystenta. Model oparty na JSONB nie sprawdził się
dostatecznie; nie przenosimy implementacji PoC.
Pierwszy krok: rejestracja e-mail/hasło i Google, logowanie oraz sesja.
Start: cztery koty Wojtka i ich badania, następnie zaproszeni przyjaciele.
Publiczny launch, lista oczekujących i kampania nie blokują pilotażu.

## P1 — Podstawy i własne użycie

- Auth skonfigurowane i sprawdzone lokalnie 2026-10-18: e-mail/hasło,
  Gmail SMTP, Google OAuth, sesja i wylogowanie (granice testów: docs/AUTH.md).
- Profile podstawowe, gospodarstwa i RLS wdrożone 2026-10-18; lista,
  dodawanie i edycja zweryfikowane z rzeczywistym Supabase na desktopie i mobile
  (zakres i ograniczenia: PETS.md).
- Formularz „Poznajmy Twojego pupila” według Stitch, prywatne awatary
  z kadrowaniem i przybliżona data urodzenia wdrożone 2026-10-18.
- Wyniki badań i ekran weryfikacji według wskazanego Split-Screen 2 wdrożone
  2026-10-18: ręczny zapis, prywatne źródła, PDF.js, zatwierdzenie parametrów.
  Rzeczywisty odczyt Gemini przeszedł test na syntetycznym PDF po doładowaniu
  Google i korekcie schematu odpowiedzi; następnie ocenić prawdziwe badania.
  Zakres i ograniczenia: MEDICAL_REPORTS.md.
- Następnie zbudować wizyty, szczepienia, profilaktykę, ręczne wyniki,
  konta rodzinne i powiadomienia na nowym modelu danych.
- Przygotować wybrane środowisko: Next.js na Vercel, backend i pliki w Supabase managed (HOSTING.md).
- Dopracować UI według projektu Stitch 1963478756572071889; strona główna Signature.
- Wprowadzić cztery koty i reprezentatywną część ich dokumentacji.
- Sprawdzić przepływ: dokument → kot i data → wpis → odnalezienie historii.
- Zweryfikować backup i odtworzenie bazy razem z plikami.

## P2 — AI na rzeczywistych badaniach

- Ekstrakcja i interpretacja, korekta oraz zatwierdzenie przed zapisem.
- Pomiar błędów wartości, jednostek, dat i przypisania do kota; osobna ocena USG.
- Interpretacja generowana raz i zapisywana po zatwierdzeniu.
- Pomiar czasu i kosztów analiz, ponowień oraz asystenta.
- Ustalenie budżetu pilotażu i limitów przed szerszym udostępnieniem AI.

## P3 — Przyjaciele

- Dostęp na zaproszenie; kontrola rejestracji w backendzie.
- Osobne gospodarstwa; sprawdzenie izolacji danych.
- Feedback z samodzielnego dodawania pupila i badań oraz odnajdywania historii.
- Weryfikacja powiadomień i możliwość zgłaszania błędów.
- Link/QR dla weterynarza według potrzeb pilotażu.

## P4 — Decyzja o szerszym otwarciu

- Zakres publicznego MVP na podstawie użycia i kosztów.
- Prepaid i Stripe przed uruchomieniem płatnych usług.
- Publiczna strona główna, ewentualny blog z Sanity i kampania.
- Dokumenty serwisu dopasowane do działania i rzeczywistych dostawców.

## Mapowanie wcześniejszych kamieni milowych

M1 → integracja P1; M2 → AI w P2; M3 → udostępnianie według potrzeb P3,
płatności przy P4. PoC nie oznacza zweryfikowanego wdrożenia całego serwisu.

## Późniejsze kierunki

Trendy badań, aplikacje natywne według potrzeb, fundacje i schroniska w IDEAS.md.
Dawne pomysły marketingowe (grupy właścicieli zwierząt, filmy z odczytem badań,
treści edukacyjne) pozostają opcjami po pilotażu.
