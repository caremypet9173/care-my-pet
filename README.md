# Care My Pet

Aplikacja webowa do zarządzania zdrowiem psów i kotów dla **właścicieli prywatnych** —
jedno miejsce na profil zwierzaka, historię medyczną, szczepienia, wizyty i wyniki
badań, z asystentem AI, który odczytuje wyniki z PDF-ów i zdjęć oraz odpowiada na
pytania o historię pupila.

- **Domena:** [caremypet.pl](https://caremypet.pl)
- **Status:** przygotowanie cichego pilotażu; M1 sprawdzone w odrębnych PoC
- **Zakres MVP:** wyłącznie właściciel prywatny (fundacje i schroniska → `docs/IDEAS.md`, v2)

---

## Sposób startu

Najpierw własne użycie: cztery koty Wojtka i ich rzeczywista, obszerna dokumentacja
badań. Następnie dostęp dla zaproszonych przyjaciół, z osobnymi gospodarstwami.
M1 jest opanowane w odrębnych PoC; kolejnym krokiem jest integracja i sprawdzenie
całego serwisu. Publiczny launch, kampania i lista oczekujących nie są warunkiem
pilotażu. Publiczna strona główna jest implementowana według wybranego projektu
Stitch „06 — Care My Pet Signature”; bez zapisów i naboru do pilotażu.

Hosting pilotażu: **Vercel Hobby + Supabase Cloud Free**. Własny serwer jest dopiero
w planach i pozostaje opcją na później. Uzasadnienie: `docs/HOSTING.md`.

## Czym to jest

Dane o zwierzaku zwykle są rozproszone: kartki, maile od weterynarza, PDF-y z
wynikami badań. Care My Pet zbiera to w jednym miejscu i pilnuje terminów
(szczepienia, odrobaczanie, wizyty). Asystent AI odczytuje wgrany dokument z
wynikami, wyciąga wartości i porównuje je z normami — ale **nic nie zapisuje bez
potwierdzenia przez użytkownika**.

### Kluczowe funkcje (MVP)
- Profil zwierzaka: dane, zdjęcia, waga z historią, numer chipa, notatki.
- Historia medyczna: wizyty, choroby, zabiegi, leki, załączniki z wynikami.
- Szczepienia i profilaktyka z automatycznymi przypomnieniami (7 i 1 dzień przed).
- Kalendarz wizyt i powiadomienia (push + email).
- Asystent AI: pytania o historię, pomoc w uzupełnianiu profilu.
- Odczyt wyników badań przez AI (funkcja płatna, model prepaid).
- Udostępnianie kartoteki weterynarzowi (link / QR read-only, z terminem ważności).
- Konta rodzinne (wspólny dostęp, historia zmian).

---

## Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Tabler Icons; własne komponenty Signature |
| Backend / BaaS | Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions, Realtime |
| Hosting | Vercel (Next.js) + Supabase managed (backend i pliki); patrz `docs/HOSTING.md` |
| PWA | next-pwa + Workbox |
| Powiadomienia | Web Push (VAPID) + Resend (email) |
| AI | Gemini (ekstrakcja) → Claude Sonnet 4.5 (interpretacja/asystent), Claude Haiku (odczyt plików) |

Szczegóły i uzasadnienia decyzji: `docs/TECH.md`.

---

## Dokumentacja

| Plik | Zawartość |
|---|---|
| `docs/PRD.md` | Zakres produktu, funkcje, user stories, co poza zakresem |
| `docs/TECH.md` | Stack, architektura, pipeline AI, model danych |
| `docs/HOSTING.md` | Porównanie hostingu dla pilotażu i status decyzji |
| `docs/DESIGN.md` | Identyfikacja wizualna i tokeny UI |
| `docs/MONETIZATION.md` | Model płatności (prepaid) i podstawa kosztowa |
| `docs/ROADMAP.md` | Etapy P1 → P4: od integracji PoC do szerszego otwarcia |
| `docs/IDEAS.md` | Worek koncepcji i zakres odłożony na v2+ |

---

## Uruchomienie lokalne

Wymagany **Node.js 24 LTS** (minimum 22) i npm 10+. Systemowy Node 18 jest za stary.
Przy menedżerze wersji można użyć `.nvmrc`.

```sh
npm ci
npm run dev
```

Podgląd: http://127.0.0.1:3000. Publiczne strony i demo działają bez `.env.local`.
Fonty i zdjęcia są lokalne. Logowanie i integracja PoC nie są jeszcze podłączone;
`/app` przekierowuje do `/login`. Nie dodawaj kluczy dostawców AI ani service role
do frontendu — ich przyszłym miejscem są sekrety backendu.

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Testy E2E uruchamiają produkcyjny serwer po buildzie; sprawdzają nawigację,
zakładki, responsywność i automatyczne reguły dostępności. Raport: `playwright-report/`.
Architektura i granice aktualnego etapu: `docs/IMPLEMENTATION.md`.

---

## Rozwój

Zasada przewodnia: MVP ma być **wąskie, ale rozwijalne**. Każda decyzja jest
podjęta pod właściciela prywatnego, ale model danych i architektura nie zamykają
drogi do segmentu organizacyjnego w przyszłości. Kierunek prac wyznacza
`docs/ROADMAP.md`.

---

## Licencja

Do ustalenia.
