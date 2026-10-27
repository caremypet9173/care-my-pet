# CLAUDE.md — Care My Pet

Instrukcje projektu dla Claude Code. Czytane na starcie każdej sesji.

## Czym jest projekt

Care My Pet to aplikacja webowa (PWA) do zarządzania zdrowiem psów i kotów dla
**właścicieli prywatnych**. Profil zwierzaka, historia medyczna, szczepienia,
wizyty, wyniki badań, asystent AI i odczyt wyników z dokumentów.

**Zakres MVP: wyłącznie właściciel prywatny.** Fundacje, schroniska, adopcje,
integracja KROPiK — świadomie odłożone na v2. Jeśli zadanie sugeruje pracę pod
segment organizacyjny, zatrzymaj się i potwierdź — to prawdopodobnie wykracza
poza MVP.

## Źródło prawdy

**Aktualny etap:** przygotowanie cichego pilotażu — najpierw cztery koty Wojtka i ich badania,
potem zaproszeni przyjaciele. Decyzja 2026-10-14: budujemy od nowa, zaczynając
od rejestracji e-mail/hasło i Google. Stare PoC potwierdziły użyteczność Gemini
w Supabase Edge Functions oraz zastosowanie pgvector do ograniczania kontekstu;
nie są bazą implementacji. Model JSONB wymaga przeprojektowania.
Nie zakładaj, że zintegrowany serwis jest już wdrożony. Landing, lista oczekujących i kampania
nie są wymagane. Wybrana strona główna: „06 — Care My Pet Signature” ze Stitch.
Fundament frontendu, publiczne demo i Auth są w repo. W projekcie
`lrlnqmciarjvngvquchu` skonfigurowano Gmail SMTP i Google OAuth. Użytkownik
potwierdził działanie logowania, sesji i wylogowania; granice testów w docs/AUTH.md.
Profile zwierząt, gospodarstwa i RLS wdrożono 2026-10-18. Lokalny frontend
obsługuje listę, dodawanie i edycję; zapis przez Edge Function `pets`.
Formularz „Poznajmy Twojego pupila” odwzorowuje wskazane ekrany Stitch
(mapowanie w `docs/stitch/DESIGN.md`), z kadrowaniem prywatnego awatara
i przybliżoną datą urodzenia. Awatary działają na liście i w profilu.
Zakres, testy i ograniczenia: `docs/PETS.md`. Następny etap: wprowadzenie
czterech kotów i dokumentacji medycznej.
Wyniki badań i weryfikacja Split-Screen 2 wdrożone 2026-10-18:
`docs/MEDICAL_REPORTS.md`. Działa ręczny zapis z prywatnym oryginałem PDF/JPG/PNG.
Klucz Gemini skonfigurowany, model `gemini-3.5-flash-lite` (zmieniony z `gemini-3.1-pro-preview` pod kątem szybkości i optymalizacji kosztów). Po doładowaniu Google
i usunięciu odrzucanego przez dostawcę `maxItems` ze schematu odpowiedzi przeszedł
rzeczywisty test PDF → Gemini → weryfikacja → zapis (2026-10-18).
Jakość odczytu na prawdziwych badaniach użytkownika pozostaje do oceny.
Projekt Stitch: https://stitch.withgoogle.com/projects/1963478756572071889.
Nie wybieraj innego projektu na podstawie domyślnej konfiguracji gcloud.
Jeśli nie wiadomo, którego szablonu Stitch użyć, zapytaj użytkownika przed
implementacją. Nie zastępuj wskazanego ekranu podobnym wariantem ani własną interpretacją.
Logowanie i rejestracja: „Forest — Ekran logowania i rejestracji”,
ekran `3ba83b4082ce4583ae27cbc1ea89c97f`.

Decyzje produktowe i techniczne żyją w `docs/`. Przed pracą nad funkcją przeczytaj
odpowiedni dokument, nie zgaduj:

- `docs/PRD.md` — zakres, funkcje, user stories, co poza zakresem
- `docs/TECH.md` — stack, architektura, pipeline AI, model danych, hosting, warstwa publiczna
- `docs/HOSTING.md` — wybrany Vercel + Supabase managed, uzasadnienie i alternatywy
- `docs/MONETIZATION.md` — model płatności (prepaid) i cennik
- `docs/ROADMAP.md` — integracja PoC, własny pilotaż, przyjaciele i szersze otwarcie (P1 → P4)
- `docs/IDEAS.md` — zakres odłożony na v2+ (nie implementować bez decyzji)

Jeśli zadanie jest sprzeczne z którymś z tych dokumentów, zgłoś sprzeczność
zamiast działać na nieaktualnym założeniu.

## Stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Tabler; komponenty Signature
- Backend: Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions (Deno), Realtime
- Hosting pilotażu: Vercel Hobby (Next.js) + Supabase Cloud Free; własny serwer dopiero w planach
- Treść publiczna: Signature, bez naboru i rejestracji; blog i Sanity odłożone
- PWA: next-pwa + Workbox; powiadomienia: Web Push (VAPID) + Resend (email)
- AI: Gemini (ekstrakcja) → Claude Sonnet 4.5 (interpretacja/asystent), Claude Haiku (odczyt plików)

## Reguły architektoniczne

- **Logika biznesowa w Supabase Edge Functions.** Warstwa hostingu (Vercel lub własny
  Next.js) obsługuje wyłącznie UI i wyzwalacze Cron — nie umieszczaj tam logiki
  domenowej.
- **Izolacja danych przez RLS.** Każdy wiersz nosi `gospodarstwo_id`; polityki RLS
  odcinają dostęp do cudzych danych na poziomie bazy. Każda migracja musi
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
- **Cap wejścia** (długość wiadomości) musi być twardą walidacją w kodzie, przed
  wysłaniem do modelu — nie instrukcją w promptcie. Odpowiedź ograniczona `max_tokens`.

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
npm run test:e2e
```
