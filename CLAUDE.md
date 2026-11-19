# CLAUDE.md — Care My Pet

Instrukcje projektu dla Claude Code. Czytane na starcie każdej sesji.

## Czym jest projekt

Care My Pet to aplikacja webowa (PWA) do zarządzania zdrowiem psów i kotów dla
**właścicieli prywatnych**. Profil zwierzaka, historia medyczna, szczepienia,
wizyty, wyniki badań, pomiary życiowe, leki, płynoterapia, asystent AI i odczyt
wyników z dokumentów.

**Zakres MVP: wyłącznie właściciel prywatny.** Fundacje, schroniska, adopcje,
integracja KROPiK — świadomie odłożone na v2. Jeśli zadanie sugeruje pracę pod
segment organizacyjny, zatrzymaj się i potwierdź — to prawdopodobnie wykracza
poza MVP.

## Źródło prawdy

**Aktualny etap (2026-11-19):** zaawansowane przygotowanie cichego pilotażu (po pełnym
audycie bezpieczeństwa, wydajności, AI/RAG i UX/A11y — Pakiety 1–4) — cztery koty
Wojtka i ich rzeczywista dokumentacja, przed szerszym udostępnieniem zaproszonym
znajomym. W projekcie Supabase `lrlnqmciarjvngvquchu` wdrożono **57 migracji SQL**
i **12 Edge Functions** (`household`, `household-recovery`, `medical-reports`,
`pet-archive`, `pet-assistant`, `pet-history`, `pet-medications`, `pet-schedule`,
`pet-share`, `pet-weight`, `pets`, `schedule-notifications` + `_shared/{rag,recovery-crypto,recovery-email,safe-origin}`).

Wdrożone obszary aplikacji:
- **Warstwa publiczna i demo:** strona główna „06 — Care My Pet Signature”
  (projekt Stitch `1963478756572071889`), pełne demo `/demo/luna`, podstrony
  informacyjne/prawne oraz waitlista (`waitlist`).
- **Auth, gospodarstwa i odzyskiwanie (`household`, `household-recovery`):**
  rejestracja/logowanie (e-mail/hasło z Gmail SMTP i Google OAuth), przełącznik
  aktywnego gospodarstwa, 3 role (`owner`, `admin`, `member` ze ścisłym rozdziałem
  uprawnień właściciela), zaproszenia, bramka pilotażu (`pilot_whitelist`) oraz
  **Klucz Odzyskiwania** (`/odzyskaj`, wzorzec Apple Legacy Contact).
- **Profile, kartoteki i archiwizacja pupili (`pets`, `pet-archive`):**
  dodawanie/edycja z kadrowaniem prywatnego awatara i przybliżoną datą urodzenia,
  kolumna `tagi` (krótkie hasła opiekuńczo-zdrowotne ze słownikiem podpowiedzi),
  opis „Parę słów o mnie” otwierany przyciskiem/modalem **„O mnie”** w kompaktowym
  `PetHeroCover`, pasek szybkiego przełączania kartotek `PetSwitcher` (pigułki do
  5 pupili na desktopie, dropdown powyżej 5 i na mobile), **Dzienny plan opieki**
  oraz archiwizacja pupila z zabezpieczonymi linkami archiwalnymi (`/archiwum/[token]`,
  kod jednorazowy PBKDF2 100k + PDF i oryginały badań).
- **Wyniki badań i dokumenty (`medical-reports`):** odczyt PDF/JPG/PNG (limit 12 MB,
  transfer przez Storage + limit 10 stron po stronie serwera przez `pdf-lib`) przez
  Gemini (`gemini-3.5-flash-lite`) z obowiązkowym ekranem potwierdzenia
  Split-Screen 2, kontrolą duplikatów SHA-256, normalizacją parametrów i
  jednostek, macierzą porównawczą trendów, obsługą badań opisowych (USG/TK/RTG)
  oraz batchowym importem kart wypisowych (`pl`/`en`).
- **Historia, pomiary życiowe i płynoterapia (`pet-history`, `pet-weight`, `fluid-therapy`):**
  wizyty, szczepienia i profilaktyka (z ekstrakcją AI), historia masy ciała,
  ciśnienia krwi (ACVIM/IRIS), glukozy i temperatury, dedykowane widoki
  płynoterapii z cyklicznymi harmonogramami wlewów.
- **Leki i terminarz (`pet-medications`, `pet-schedule`, `schedule-notifications`):**
  harmonogramy leków z wieloma porami podania, logowaniem podań/pominięć,
  śledzeniem zapasu, współdzielonym Supabase Realtime i kartą leczenia do druku;
  kalendarz (dzień/tydzień/miesiąc/agenda) z powiadomieniami Web Push (VAPID,
  deduplikacja i czyszczenie wygasłych 404/410) oraz SMTP (Nodemailer z pulą połączeń
  i dodatkowymi odbiorcami e-mail).
- **Asystent AI (`pet-assistant`) i udostępnianie (`pet-share`):** wielowątkowy
  czat z RAG (`pgvector 0.8.2` z `hnsw.iterative_scan`, `gemini-embedding-001` z
  `taskType` i pomijaniem re-embeddingu po SHA-256), pełnym kontekstem kartoteki
  (w tym tagów, pomiarów, leków i płynoterapii), eksportem podsumowań do PDF oraz
  tymczasowymi linkami/QR read-only dla weterynarza (`/udostepnione/[token]`).

Projekt Stitch: https://stitch.withgoogle.com/projects/1963478756572071889.
Nie wybieraj innego projektu na podstawie domyślnej konfiguracji gcloud.
Jeśli nie wiadomo, którego szablonu Stitch użyć, zapytaj użytkownika przed
implementacją. Nie zastępuj wskazanego ekranu podobnym wariantem ani własną
interpretacją (zatwierdzone korekty: `docs/stitch/DESIGN.md`).

Decyzje produktowe i techniczne żyją w `docs/`. Przed pracą nad funkcją przeczytaj
odpowiedni dokument, nie zgaduj:

- `docs/PRD.md` — zakres, funkcje, user stories, co poza zakresem
- `docs/TECH.md` — stack, architektura, pipeline AI, model danych, hosting, warstwa publiczna
- `docs/HOSTING.md` — wybrany Vercel + Supabase managed, uzasadnienie i alternatywy
- `docs/MONETIZATION.md` — model płatności (prepaid) i cennik
- `docs/ROADMAP.md` — integracja PoC, własny pilotaż, przyjaciele i szersze otwarcie (P1 → P4)
- `docs/IDEAS.md` — zakres odłożony na v2+ (nie implementować bez decyzji)
- `docs/AUTH.md`, `docs/PETS.md`, `docs/MEDICAL_REPORTS.md`, `docs/WEIGHT.md` — specyfikacje i granice testów modułów

Jeśli zadanie jest sprzeczne z którymś z tych dokumentów, zgłoś sprzeczność
zamiast działać na nieaktualnym założeniu.

## Stack

- Frontend: Next.js 16 (`16.4.5`, App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Tabler Icons, `next-intl` (`pl`/`en`); komponenty Signature
- Backend: Supabase — PostgreSQL + RLS + `pgvector`, Auth, Storage, Edge Functions (Deno), Realtime
- Hosting pilotażu: Vercel Hobby (Next.js) + Supabase Cloud Free; własny serwer dopiero w planach
- Treść publiczna: Signature, demo `/demo/luna`, waitlista w bazie (`waitlist`); blog i Sanity odłożone
- PWA: natywny manifest (`src/app/manifest.ts`) + własny Service Worker (`public/sw.js` v3: prywatne trasy Network-Only, bypass na `localhost`/`127.0.0.1`) + nagłówki bezpieczeństwa / CSP (`next.config.ts`)
- Powiadomienia: Web Push (VAPID, `npm:web-push` w Deno Edge Function) + e-mail SMTP (`nodemailer`)
- AI: Gemini (`gemini-3.5-flash-lite`, konfigurowalne przez `GEMINI_MODEL`) do ekstrakcji, opisów i asystenta + embeddingi `gemini-embedding-001` (`pgvector 0.8.2`, `hnsw.iterative_scan`)

## Reguły architektoniczne

- **Logika biznesowa w Supabase Edge Functions.** Warstwa hostingu (Vercel lub własny
  Next.js) obsługuje wyłącznie UI i wyzwalacze Cron — nie umieszczaj tam logiki
  domenowej.
- **Izolacja danych przez RLS.** Każdy wiersz nosi `gospodarstwo_id` (lub `household_id`);
  polityki RLS odcinają dostęp do cudzych danych na poziomie bazy. Każda migracja musi
  uwzględniać polityki RLS.
- **Migracje SQL numerowane i odtwarzalne** — każda zmiana schematu to osobny,
  kolejno numerowany plik migracji.
- **Zasada krytyczna: Supabase Data API Grants dla nowych tabel (od 30.10.2026)** —
  nowe tabele w schemacie `public` nie otrzymują automatycznych uprawnień dla Data API.
  Każde `CREATE TABLE public.<tabela>` w migracji SQL musi mieć jawne `GRANT`
  (dla `anon`, `authenticated` i `service_role`) przed `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  i politykami RLS (pełny szablon w `AGENTS.md`).

## Reguły AI

- **Nic nie zapisuje się do bazy bez potwierdzenia użytkownika.** Ekstrakcja z
  dokumentów zawsze przechodzi przez ekran zatwierdzenia — to ochrona przed
  halucynacją przy danych medycznych.
- Interpretacja wyników generowana **raz przy skanie** i zapisywana, nie liczona
  per otwarcie.
- Docelowy asystent: darmowy do 20 wiadomości/dzień, nadwyżka 0,01 EUR z salda.
  Rozliczanie pilotażu pozostaje do ustalenia; Stripe nie blokuje jego startu.
- **Cap wejścia** (długość wiadomości, `MAX_MESSAGE_CHARS = 800`) musi być twardą
  walidacją w kodzie, przed wysłaniem do modelu — nie instrukcją w promptcie.
  Odpowiedź ograniczona `MAX_OUTPUT_TOKENS = 1200`.

## Konwencje pracy

- Użytkownik pracuje w **Codex CLI**, nie w aplikacji desktopowej. Instrukcje
  konfiguracji dostosowuj do terminala; Supabase konfiguruj przez CLI lub MCP.
- Wszystkie operacje Git wykonuj przez `.\git-shell.ps1` (Git w Dockerze),
  zgodnie z `AGENTS.md`. Nie używaj hostowego `git.exe`.
- Język roboczy: polski. Commit messages: conventional commits (`feat:`, `fix:`,
  `docs:`, `chore:`…).
- Odpowiadaj wprost, wskazuj przyczynę źródłową — bez owijania.
- Fixy weryfikuj na realnych danych (dokładny komunikat błędu, wynik SQL,
  screenshot), nie na założeniach.
- Nie commituj sekretów. `.env.local` i `.claude/settings.local.json` są w `.gitignore`.

## Komendy

Node.js 24 LTS (minimum 22). Publiczny frontend nie wymaga sekretów.

```
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```
