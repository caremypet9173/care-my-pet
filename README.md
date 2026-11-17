# Care My Pet

Aplikacja webowa (PWA) do zarządzania zdrowiem psów i kotów dla **właścicieli prywatnych** —
jedno miejsce na profil zwierzaka, historię medyczną, szczepienia, wizyty, wyniki
badań, pomiary, leki i płynoterapię, z asystentem AI, który odczytuje wyniki z
PDF-ów i zdjęć oraz odpowiada na pytania o historię pupila.

- **Domena:** [caremypet.pl](https://caremypet.pl)
- **Status:** zaawansowane przygotowanie cichego pilotażu (`50` migracji SQL, `10` Edge Functions)
- **Zakres MVP:** wyłącznie właściciel prywatny (fundacje i schroniska → `docs/IDEAS.md`, v2)

---

## Sposób startu

Najpierw własne użycie: cztery koty Wojtka i ich rzeczywista, obszerna dokumentacja
badań. Następnie dostęp dla zaproszonych przyjaciół z osobnymi gospodarstwami
(kontrola dostępu przez `pilot_whitelist`, opcjonalna `waitlist`). Publiczna strona
główna jest zaimplementowana według projektu Stitch „06 — Care My Pet Signature”.

Hosting pilotażu: **Vercel Hobby + Supabase Cloud Free**. Własny serwer pozostaje
opcją na później. Uzasadnienie: `docs/HOSTING.md`.

## Czym to jest

Dane o zwierzaku zwykle są rozproszone: kartki, maile od weterynarza, PDF-y z
wynikami badań. Care My Pet zbiera to w jednym miejscu i pilnuje terminów
(szczepienia, odrobaczanie, wizyty, dawki leków i kroplówek). Asystent AI odczytuje
wgrany dokument z wynikami lub wypis z wizyty, wyciąga wartości i porównuje je z normami —
ale **nic nie zapisuje bez potwierdzenia przez użytkownika**.

### Kluczowe funkcje (MVP)
- **Profil pupila:** dane podstawowe, prywatne zdjęcia z kadrowaniem, chip/tatuaż, tagi opiekuńczo-zdrowotne (słownik podpowiedzi + własne hasła), opis „Parę słów o mnie” (modal „O mnie”) oraz szybki przełącznik kartotek między pupilami gospodarstwa.
- **Pomiary zdrowia i płynoterapia:** waga z historią i trendem, ciśnienie krwi (ACVIM/IRIS), glukoza, temperatura oraz ewidencja i cykliczne harmonogramy wlewów płynoterapii.
- **Historia medyczna i dokumenty:** wizyty, choroby, szczepienia, profilaktyka, załączniki z podglądem PDF.js i ekstrakcją wpisów przez AI.
- **Leki i Dzienny plan opieki:** harmonogramy leków z wieloma porami podania, logowaniem podań/pominięć, śledzeniem zapasu, Supabase Realtime oraz kartą leczenia do druku.
- **Wyniki badań (AI + ręcznie):** odczyt parametrów i opisów (w tym badań obrazowych USG/TK/RTG), batchowy import kart wypisowych, detekcja duplikatów SHA-256, normalizacja nazw/jednostek oraz macierz porównawcza trendów.
- **Kalendarz opieki i powiadomienia:** widoki dzień/tydzień/miesiąc/agenda z przypomnieniami Web Push (VAPID) i e-mail (SMTP), również na dodatkowe adresy odbiorców.
- **Asystent AI (RAG):** wielowątkowe rozmowy z kontekstem wektorowym (`pgvector`) oraz pełnej kartoteki pupila, plus eksport podsumowań do PDF.
- **Udostępnianie weterynarzowi:** tymczasowe linki i kody QR read-only (`/udostepnione/[token]`) z logiem otwarć.
- **Konta rodzinne:** wspólne gospodarstwo domowe (właściciel + współopiekunowie), zaproszenia oraz historia zmian.

---

## Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Tabler Icons, `next-intl` (`pl`/`en`); komponenty Signature |
| Backend / BaaS | Supabase — PostgreSQL + RLS + `pgvector`, Auth, Storage, Edge Functions (Deno), Realtime |
| Hosting | Vercel (Next.js) + Supabase managed (backend i pliki); patrz `docs/HOSTING.md` |
| PWA | Natywny manifest (`src/app/manifest.ts`) + własny Service Worker (`public/sw.js`) |
| Powiadomienia | Web Push (VAPID, `web-push`) + SMTP (`nodemailer`) |
| AI | Gemini (`gemini-3.5-flash-lite`) + embeddingi `gemini-embedding-2` / `gemini-embedding-001` (`pgvector`) |

Szczegóły i uzasadnienia decyzji: `docs/TECH.md`.

---

## Dokumentacja

| Plik | Zawartość |
|---|---|
| `docs/PRD.md` | Zakres produktu, funkcje, user stories, co poza zakresem |
| `docs/TECH.md` | Stack, architektura, pipeline AI, model danych |
| `docs/HOSTING.md` | Porównanie hostingu dla pilotażu i status decyzji |
| `docs/DESIGN.md` | Identyfikacja wizualna, tokeny UI i zasady Stitch (`docs/stitch/DESIGN.md`) |
| `docs/MONETIZATION.md` | Model płatności (prepaid) i podstawa kosztowa |
| `docs/ROADMAP.md` | Etapy P1 → P4: od integracji i pilotażu do szerszego otwarcia |
| `docs/IDEAS.md` | Worek koncepcji i zakres odłożony na v2+ |
| `docs/AUTH.md`, `docs/PETS.md`, `docs/MEDICAL_REPORTS.md`, `docs/WEIGHT.md` | Specyfikacje techniczne i granice testów poszczególnych modułów |
| `docs/IMPLEMENTATION.md`, `docs/ASSETS.md` | Fundament Signature, architektura kodu i pochodzenie assetów |

---

## Uruchomienie lokalne

Wymagany **Node.js 24 LTS** (minimum 22) i npm 10+. Systemowy Node 18 jest za stary.
Przy menedżerze wersji można użyć `.nvmrc`.

```sh
npm ci
npm run dev
```

Podgląd: http://127.0.0.1:3000. Publiczne strony i demo działają bez `.env.local`.
Fonty i zdjęcia są lokalne. Konfigurację Auth opisuje `docs/AUTH.md`.
`/app` wymaga sesji zweryfikowanej na serwerze. Nie dodawaj kluczy dostawców AI ani service role
do frontendu — ich miejscem są sekrety Supabase Edge Functions.

```sh
npm run lint
npm run typecheck
node --test tests/*.test.mjs
npm run build
npx playwright install chromium
npm run test:e2e
```

Testy E2E uruchamiają produkcyjny serwer po buildzie; sprawdzają nawigację,
zakładki, responsywność i automatyczne reguły dostępności. Raport: `playwright-report/`.
Architektura pierwszego etapu: `docs/IMPLEMENTATION.md`.

---

## Rozwój

Zasada przewodnia: MVP ma być **wąskie, ale rozwijalne**. Każda decyzja jest
podjęta pod właściciela prywatnego, ale model danych i architektura nie zamykają
drogi do segmentu organizacyjnego w przyszłości. Kierunek prac wyznacza
`docs/ROADMAP.md`.

---

## Licencja

Do ustalenia.
