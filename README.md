# Care My Pet

Aplikacja webowa do zarządzania zdrowiem psów i kotów dla **właścicieli prywatnych** —
jedno miejsce na profil zwierzaka, historię medyczną, szczepienia, wizyty i wyniki
badań, z asystentem AI, który odczytuje wyniki z PDF-ów i zdjęć oraz odpowiada na
pytania o historię pupila.

- **Domena:** [caremypet.pl](https://caremypet.pl)
- **Status:** MVP w budowie
- **Zakres MVP:** wyłącznie właściciel prywatny (fundacje i schroniska → `docs/IDEAS.md`, v2)

---

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
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend / BaaS | Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions, Realtime |
| Hosting | Vercel (UI + Cron) |
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
| `docs/MONETIZATION.md` | Model płatności (prepaid) i podstawa kosztowa |
| `docs/ROADMAP.md` | Kamienie milowe M1 → M3 i kierunki po MVP |
| `docs/IDEAS.md` | Worek koncepcji i zakres odłożony na v2+ |

---

## Uruchomienie lokalne

> Szczegółowe instrukcje pojawią się wraz z pierwszym kodem (kamień milowy M1).

Aplikacja będzie wymagać zmiennych środowiskowych (`.env.local`, nie commitować):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
```

---

## Rozwój

Zasada przewodnia: MVP ma być **wąskie, ale rozwijalne**. Każda decyzja jest
podjęta pod właściciela prywatnego, ale model danych i architektura nie zamykają
drogi do segmentu organizacyjnego w przyszłości. Kierunek prac wyznacza
`docs/ROADMAP.md`.

---

## Licencja

Do ustalenia.
