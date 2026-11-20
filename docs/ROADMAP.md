# ROADMAP

**Wersja:** 0.5 (cichy pilotaż — stan po audycie Pakiety 1–4)
**Data:** 2026-11-19
**Powiązane:** PRD.md, TECH.md, HOSTING.md, MONETIZATION.md

## Punkt wyjścia

Decyzja 2026-10-14: aplikację budujemy od nowa (bez przenoszenia starego PoC
opartego na JSONB). Start: cztery koty Wojtka i ich badania, następnie zaproszeni
przyjaciele. Publiczny launch, blog i kampania nie blokują pilotażu.

## P1 — Podstawy i własne użycie

### Zrealizowane w kodzie i Supabase (`2026-10-18` – `2026-11-20`, 60 migracji, 12 Edge Functions)
- **Auth i kontrola dostępu:** rejestracja/logowanie e-mail/hasło (Gmail SMTP)
  i Google OAuth (`docs/AUTH.md`), bramka pilotażu (`pilot_whitelist`),
  tabela `waitlist`, bezpieczna walidacja przekierowań (`sanitizeRelativePath`)
  oraz nagłówki CSP / bezpieczeństwa w `next.config.ts`.
- **Gospodarstwa, konta rodzinne i odzyskiwanie:** 3 role (`owner`, `admin`,
  `member` z ścisłą izolacją operacji właściciela), zaproszenia, przełącznik
  gospodarstwa w nagłówku, pełne RLS (zoptymalizowane do InitPlan) oraz
  **Klucz Odzyskiwania** (`/recover`, `household-recovery`).
- **Profile i archiwizacja pupili:** formularz z lokalnym kadrowaniem prywatnego
  awatara i przybliżoną datą urodzenia (`docs/PETS.md`), system tagów
  opiekuńczo-zdrowotnych (`tagi` ze słownikiem podpowiedzi), kompaktowe hero z
  przyciskiem/modalem „O mnie”, szybki przełącznik kartotek `PetSwitcher` oraz
  archiwizacja pupila z zabezpieczonymi linkami archiwalnymi (`/archive/[token]`,
  `pet-archive`, kod PBKDF2 100k + raport PDF i oryginały załączników).
- **Wyniki badań i dokumenty:** odczyt PDF/JPG/PNG do 12 MB przez Gemini
  (`gemini-3.5-flash-lite`, transfer przez Storage + limit 10 stron po stronie
  serwera), ekran weryfikacji Split-Screen 2, kontrola duplikatów SHA-256,
  korekty pomiarów, normalizacja parametrów/jednostek, macierz porównawcza
  trendów, obsługa badań opisowych (USG/TK/RTG) i batchowy import kart wypisowych
  `pl`/`en` (`docs/MEDICAL_REPORTS.md`).
- **Pomiary zdrowia i płynoterapia:** waga (`docs/WEIGHT.md`), ciśnienie krwi
  (ACVIM/IRIS), glukoza, temperatura oraz moduł płynoterapii (wlewy i cykliczne
  harmonogramy).
- **Historia, leki i terminarz:** oś czasu wizyt/szczepień/profilaktyki (z
  odczytem AI z dokumentu), harmonogramy leków (wiele pór dnia, śledzenie zapasu,
  Dzienny plan opieki na wspólnym Supabase Realtime, karta leczenia do druku)
  oraz kalendarz opieki z powiadomieniami Web Push (VAPID, deduplikacja i
  czyszczenie wygasłych subskrypcji 404/410) i SMTP (Nodemailer z pulą połączeń).
- **Asystent AI i udostępnianie:** wielowątkowy czat z RAG (`pgvector 0.8.2` z
  `hnsw.iterative_scan`, `gemini-embedding-001` z `taskType` i SHA-256 skip),
  kontekst pełnej kartoteki (z tagami, pomiarami, lekami i płynoterapią),
  eksport podsumowań do PDF oraz tymczasowe linki/QR read-only dla weterynarza.
- **Wydajność, PWA i A11y/UX:** `React.cache()` dla SSR, leniwe ładowanie
  `pdf-lib`/`fontkit`/`qrcode`/modali, podział CSS (Tailwind wyłącznie w panelu
  prywatnym), `unicode-range` latin preload fontów, Service Worker `sw.js` v3
  (prywatne trasy Network-Only), natywne `<dialog>`, ARIA kalendarza i
  dopasowanie mobilne 320px/390px.

### Pozostało w P1 przed pełnym przejściem na produkcję pilotażu
- Publikacja aplikacji Next.js na docelowym środowisku Vercel (`HOSTING.md`) i
  konfiguracja cyklicznego wyzwalacza Cron dla `schedule-notifications`.
- Wprowadzenie kompletu danych czterech kotów i weryfikacja przepływu na
  prawdziwych badaniach (dokument → kot i data → wpis → odnalezienie historii).
- Praktyczny test backupu i odtworzenia bazy razem z plikami Storage.

## P2 — AI na rzeczywistych badaniach

- Ocena jakości ekstrakcji, dat, norm i przypisania do kota na rzeczywistym
  zbiorze badań i opisów USG/TK/wypisów czterech kotów.
- Analiza czasu odpowiedzi i realnych kosztów z `private.ai_usage_log` /
  `private.ai_cost_summary` (zarówno ekstrakcji, jak i Asystenta AI).
- Ustalenie budżetu pilotażu i ewentualna kalibracja limitów (10 analiz/dzień,
  20 wiadomości/dzień) przed udostępnieniem przyjaciołom.

## P3 — Przyjaciele

- Udostępnienie kont zaproszonym osobom (`pilot_whitelist`).
- Weryfikacja izolacji gospodarstw oraz zbieranie feedbacku z samodzielnego
  dodawania pupili, leków, badań i udostępniania kartoteki linkiem/QR weterynarzowi.
- Weryfikacja działania powiadomień push i e-mail u zewnętrznych testerów.

## P4 — Decyzja o szerszym otwarciu

- Zakres publicznego MVP na podstawie danych o użyciu i kosztach.
- Prepaid i Stripe przed uruchomieniem płatnych usług (`MONETIZATION.md`).
- Szersza kampania, ewentualny blog z Sanity i SEO (`TECH.md` §8).
- Dopasowanie dokumentów prawnych (`/privacy`, `/terms`) do docelowych
  dostawców i operacji przed otwartą rejestracją.

## Mapowanie wcześniejszych kamieni milowych

M1 → integracja P1; M2 → AI w P2; M3 → udostępnianie wdrożone już w P1 (weryfikacja
w P3), płatności przy P4.

## Późniejsze kierunki

Trendy badań, aplikacje natywne według potrzeb, fundacje, schroniska i KROPiK
w `IDEAS.md`.
