# TECH — Stack i architektura

**Wersja:** 0.4 (MVP / cichy pilotaż — aktualizacja do stanu repo)
**Data:** 2026-11-17
**Status:** Aktywny
**Powiązane:** PRD.md, ROADMAP.md, MONETIZATION.md, DESIGN.md

Jeden dokument dla stacku i architektury: warstwy aplikacji, dane, pipeline AI,
hosting i warstwa publiczna.

---

## 1. Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16 (`16.4.5`, App Router, Turbopack), React 19 (`19.3.0`), TypeScript, Tailwind CSS 4, Tabler Icons, `next-intl` (`pl`/`en`); komponenty Signature |
| Backend / BaaS | Supabase — PostgreSQL + RLS + `pgvector`, Auth, Storage, Edge Functions (Deno), Realtime |
| Hosting | Vercel (Next.js) + Supabase managed (backend i pliki) — patrz `HOSTING.md` |
| PWA | Natywny manifest (`src/app/manifest.ts`) + własny Service Worker (`public/sw.js`, cache `caremypet-v2`, bypass w trybie lokalnym) |
| Powiadomienia | Web Push VAPID (`web-push`) + e-mail SMTP (`nodemailer`) |
| AI (ekstrakcja i asystent) | Gemini (`GEMINI_MODEL`, domyślnie `gemini-3.5-flash-lite`) |
| RAG / embeddingi | `gemini-embedding-2` / `gemini-embedding-001` (768D) + `pgvector` (`pet_knowledge_chunk`) |
| PDF po stronie klienta | `pdfjs-dist` (podgląd oryginałów) + `pdf-lib` / `@pdf-lib/fontkit` (dzielenie stron wypisów i eksport podsumowań AI) |

*(Uwaga historyczna: wcześniejsze szkice przewidywały użycie Claude Sonnet/Haiku,
Resend oraz `@ducanh2912/next-pwa` + Workbox. W bieżącej implementacji całość AI
obsługuje API Gemini, pocztę SMTP realizuje Nodemailer, a PWA opiera się na
natywnym manifeście Next.js i własnym `public/sw.js`.)*

**Typografia i kolory:** patrz `DESIGN.md`. UI budowany na tokenach
semantycznych (`--color-primary` itd.), nie na wartościach hex w kodzie.

---

## 2. Zasady architektury

- **Cała logika biznesowa w Supabase Edge Functions.** Warstwa hostingu
  (Vercel lub własny Next.js) obsługuje wyłącznie UI, SSR oraz wyzwalacze Cron —
  nie trzyma logiki domenowej. Wdrożone funkcje (`supabase/functions/`):
  `household`, `medical-reports`, `pet-assistant`, `pet-history`,
  `pet-medications`, `pet-schedule`, `pet-share`, `pet-weight`, `pets`,
  `schedule-notifications` (oraz współdzielony moduł `_shared/rag.ts`).
- **Auth przez Supabase** (`@supabase/ssr`), `src/proxy.ts` jako bramka UI i
  odświeżania sesji dla tras `/{locale}/app`, `/login`, `/register`, `/auth`.
  Dostęp kontrolowany przez tabelę `pilot_whitelist` (`check_pilot_access`).
- **Izolacja danych przez RLS.** Właściciele współdzielą jedną bazę; każdy wiersz
  ma `gospodarstwo_id` (lub `household_id`), a polityki RLS odcinają dostęp do
  cudzych danych na poziomie silnika bazy. Nowe tabele `public.*` mają jawne
  uprawnienia `GRANT` przed włączeniem RLS (`AGENTS.md`).
- **Storage:** prywatne buckety `pet-avatars` i `medical-documents` z politykami
  RLS na ścieżkach gospodarstwa/użytkownika i czasowymi podpisanymi URL-ami
  generowanymi po stronie serwera.
- **Bez osobnych baz per tenant.** Dla MVP właścicielskiego multi-tenant przez RLS
  wystarcza; osobne bazy per tenant dokładamy dopiero przy wejściu segmentu
  organizacyjnego (v2).

---

## 3. Pipeline AI — odczyt dokumentów i asystent

### 3.1 Odczyt wyników badań, opisów (USG/TK/RTG) i kart wypisowych

```
plik (PDF/JPG/PNG)
   │
   ├─▶ SHA-256 + walidacja rozmiaru i sygnatury pliku
   │
   ├─▶ Gemini (gemini-3.5-flash-lite, JSON Schema)
   │      ├─ badania lab: parametry, wartości, jednostki, zakresy, wstępna interpretacja
   │      ├─ badania opisowe: pełny opis + wnioski (rows: [])
   │      └─ karty wypisowe (batch): podział na raporty lab, zdarzenia, pomiary i leki
   │
   ▼
ekran weryfikacji Split-Screen 2 — do ZATWIERDZENIA przez użytkownika
   │
   ▼
zapis atomowy w bazie (RPC) + indeksacja RAG (`pet_knowledge_chunk`) + log kosztu (`private.ai_usage_log`)
```

**Twarde zasady:**
- Żadna wartość nie trafia do bazy bez potwierdzenia użytkownika.
- Wstępna interpretacja wyników jest generowana **raz przy skanie dokumentu**
  i zapisywana w bazie (nie przeliczana per otwarcie).
- Korekty parametrów zapisują się jako osobne rewizje (`measurement_correction`),
  zachowując niezmienny odczyt źródłowy (`pomiar_parametru`).
- Twarda dzienna quota na ekstrakcję dokumentów (`private.medical_read_quota`,
  10 prób/dobę UTC na konto).

### 3.2 Kontrola kosztu i kontekst Asystenta AI (`pet-assistant`)

Koszt zapytania zależy od tokenów, więc działają twarde zabezpieczenia w kodzie
Edge Function `pet-assistant`:
- **Cap wejścia:** `MAX_MESSAGE_CHARS = 800` walidowany przed wysłaniem do modelu.
- **Cap wyjścia:** `MAX_OUTPUT_TOKENS = 1200`.
- **Dzienny limit wiadomości:** `DAILY_MESSAGE_LIMIT = 20` atomowo przez `private.ai_assistant_quota`.
- **Ograniczony kontekst (RAG + strukturalny snapshot):** wyszukiwanie
  semantyczne (`match_pet_knowledge` na `pgvector`) + lekki ranking leksykalny i
  najnowsze wpisy z profilu (w tym `tagi` i `notatki`), wagi, parametrów
  życiowych, leków, płynoterapii oraz terminarza.
- **Księgowanie użycia:** każde wywołanie AI loguje tokeny, czas i szacowany
  koszt USD w `private.ai_usage_log` (widok `private.ai_cost_summary`).

---

## 4. Model danych (stan z 50 migracji SQL)

- **Gospodarstwa i dostęp:** `gospodarstwo`, `czlonek_gospodarstwa`,
  `zaproszenie_gospodarstwa`, `pilot_whitelist`, `waitlist`
- **Pupile:** `zwierze` (m.in. gatunek, rasa, płeć, przybliżona data urodzenia,
  kastracja, identyfikacja/chip, `tagi text[]`, `notatki`, `avatar_path`)
- **Wyniki badań (znormalizowane):** `wynik_badania`, `pomiar_parametru`,
  `measurement_correction`
- **Pomiary zdrowia i terapia:** `pet_weight`, `pet_vital_measurement`
  (ciśnienie krwi, glukoza, temperatura), `pet_fluid_therapy`
- **Historia, leki i terminarz:** `pet_health_event`, `medication_schedules`
  (obsługuje też cykliczne harmonogramy płynoterapii), `medication_logs`,
  `pet_schedule_item`, `household_notification_settings`,
  `schedule_notification_log`, `pet_push_subscription`
- **Udostępnianie weterynarzowi:** `pet_share_link`, `pet_share_open_log`
- **AI / RAG:** `pet_knowledge_chunk` (`vector(768)` + indeks HNSW),
  `pet_assistant_thread`, `pet_assistant_message`
- **Schemat prywatny (`private.*`):** `medical_read_quota`,
  `ai_assistant_quota`, `ai_usage_log`

---

## 5. Status wcześniejszych tematów i decyzje otwarte

| Temat | Status / uwagi |
|---|---|
| Znormalizowany schemat wyników badań | **Wdrożone** (`wynik_badania`, `pomiar_parametru`, `measurement_correction`, normalizacja jednostek i macierz trendów) |
| Badania opisowe (USG/TK/RTG) i import wypisów | **Wdrożone** (obsługa `rows: []`, `notes` do 12 000 znaków, batchowy import kart wypisowych) |
| Model AI do odczytu i asystenta | **Gemini (`gemini-3.5-flash-lite`)** w obu rolach; obserwować jakość i koszt w pilotażu |
| Migracja Storage na R2/S3 | Odłożone — obecny `Supabase Storage` wystarcza na pilotaż |
| Automatyczny Cron dla `schedule-notifications` | Do wpięcia przy produkcyjnym wdrożeniu (wyzwalacz harmonogramu powiadomień) |

---

## 6. Alternatywy rozważone i odrzucone

| Rozwiązanie | Dlaczego nie |
|---|---|
| Flutter + własny backend Node.js | Zbędny narzut na MVP; Next.js + Supabase daje UI i backend w jednym ekosystemie |
| Osobna baza per tenant | Multi-tenant przez RLS wystarcza dla właścicieli prywatnych |
| Lokalny model AI (Llama/Mistral) | Słabszy odczyt PDF/obrazów, wymóg GPU, wyższy koszt przy małej skali |
| Firebase / NoSQL | Utrudnia multi-tenant z RLS i relacyjne zapytania z `pgvector` |

---

## 7. Hosting i infrastruktura — Vercel + Supabase managed

**Decyzja 2026-09-28:** pilotaż na Vercel Hobby + Supabase Cloud Free.
Własny serwer jest w planach na później (`HOSTING.md`). Next.js działa na Vercel;
baza, Auth, Storage, Realtime i Edge Functions w Supabase managed.

### Utrzymanie i ewentualny późniejszy self-host

W pilotażu po naszej stronie pozostają kod, migracje, konfiguracja dostępu,
kontrola kosztów AI i kopie zapasowe (bazy **oraz plików Storage**, ponieważ
backup Supabase nie obejmuje zawartości bucketów). Dla ewentualnego self-hosta
punktem wyjścia pozostaje pojedynczy serwer z Docker Compose.

### Cache

Panel (`/app/*`), odpowiedzi sesyjne i dokumenty nie trafiają do publicznego
cache (`Cache-Control: private, no-store`). Publiczne assety mogą być
cache'owane na produkcji; w trybie lokalnym (`127.0.0.1` / `localhost`)
Service Worker `public/sw.js` całkowicie pomija przechwytywanie żądań `fetch`.

---

## 8. Strona główna i warstwa publiczna

Strona główna „06 — Care My Pet Signature” ze Stitch oraz pełne publiczne demo
`/demo/luna` (profil, historia, wyniki, dokumenty) są wdrożone w repozytorium.
Moduł Auth, zaproszenia do gospodarstw, lista kontrolna pilotażu
(`pilot_whitelist`) i tabela listy oczekujących (`waitlist`) działają w backendzie.
Blog i CMS Sanity pozostają odłożone do decyzji o szerokim, publicznym otwarciu.
