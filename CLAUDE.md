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

Decyzje produktowe i techniczne żyją w `docs/`. Przed pracą nad funkcją przeczytaj
odpowiedni dokument, nie zgaduj:

- `docs/PRD.md` — zakres, funkcje, user stories, co poza zakresem
- `docs/TECH.md` — stack, architektura, pipeline AI, model danych
- `docs/MONETIZATION.md` — model płatności (prepaid) i cennik
- `docs/ROADMAP.md` — kolejność prac (M1 → M3)
- `docs/IDEAS.md` — zakres odłożony na v2+ (nie implementować bez decyzji)

Jeśli zadanie jest sprzeczne z którymś z tych dokumentów, zgłoś sprzeczność
zamiast działać na nieaktualnym założeniu.

## Stack

- Frontend: Next.js 15 (App Router), React 19, TypeScript, Tailwind, shadcn/ui
- Backend: Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions (Deno), Realtime
- Hosting: Vercel (tylko UI + Cron)
- PWA: next-pwa + Workbox; powiadomienia: Web Push (VAPID) + Resend (email)
- AI: Gemini (ekstrakcja) → Claude Sonnet 4.5 (interpretacja/asystent), Claude Haiku (odczyt plików)

## Reguły architektoniczne

- **Logika biznesowa w Supabase Edge Functions.** Vercel obsługuje wyłącznie UI i
  wyzwalacze Cron — nie umieszczaj tam logiki domenowej.
- **Izolacja danych przez RLS.** Każdy wiersz nosi `gospodarstwo_id`; polityki RLS
  odcinają dostęp do cudzych danych na poziomie bazy. Każda migracja musi
  uwzględniać polityki RLS.
- **Migracje SQL numerowane i odtwarzalne** — każda zmiana schematu to osobny,
  kolejno numerowany plik migracji.

## Reguły AI

- **Nic nie zapisuje się do bazy bez potwierdzenia użytkownika.** Ekstrakcja z
  dokumentów zawsze przechodzi przez ekran zatwierdzenia — to ochrona przed
  halucynacją przy danych medycznych.
- Interpretacja wyników generowana **raz przy skanie** i zapisywana, nie liczona
  per otwarcie.
- Asystent konwersacyjny: darmowy do 20 wiadomości/dzień, nadwyżka 0,01 EUR z salda.
- **Cap wejścia** (długość wiadomości) musi być twardą walidacją w kodzie, przed
  wysłaniem do modelu — nie instrukcją w promptcie. Odpowiedź ograniczona `max_tokens`.

## Konwencje pracy

- Język roboczy: polski. Commit messages: conventional commits (`feat:`, `fix:`,
  `docs:`, `chore:`…).
- Odpowiadaj wprost, wskazuj przyczynę źródłową — bez owijania.
- Fixy weryfikuj na realnych danych (dokładny komunikat błędu, wynik SQL,
  screenshot), nie na założeniach.
- Nie commituj sekretów. `.env.local` i `.claude/settings.local.json` są w `.gitignore`.

## Komendy

> Uzupełnić wraz z pierwszym scaffoldingiem (M1). Oczekiwane:

```
# dev:   npm run dev
# build: npm run build
# lint:  npm run lint
# db:    supabase start / supabase db push
```
