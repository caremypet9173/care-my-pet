# ROADMAP

**Wersja:** 0.2 (MVP)
**Data:** 2026-09-15
**Powiązane:** PRD.md, TECH.md, MONETIZATION.md

Trzy kamienie milowe do launchu MVP, potem kierunki rozwoju. Kolejność jest
celowa: najpierw pokazywalny rdzeń, potem AI, na końcu płatności.

---

## M1 — Core  *(pierwszy pokazywalny MVP)*

Fundament, który da się pokazać ludziom i zbierać feedback.

- Rejestracja i logowanie (Supabase Auth).
- CRUD profili zwierząt, wizyt, szczepień i profilaktyki.
- Ręczne wpisywanie wyników badań.
- Konta rodzinne (zaproszenia, historia zmian).
- Powiadomienia email + push (7 i 1 dzień przed terminem).

## M2 — AI

Warstwa, która odróżnia produkt od zwykłego notatnika.

- Asystent konwersacyjny (pytania o historię, pomoc w uzupełnianiu profilu).
- Pipeline odczytu wyników: Gemini (ekstrakcja) → Claude (interpretacja).
- Zasada zatwierdzania — nic nie zapisuje się bez potwierdzenia użytkownika.
- Interpretacja generowana raz przy skanie i zapisywana (offline, zero tokenów per klik).

## M3 — Płatności i udostępnianie

Domknięcie modelu i funkcji, które monetyzujemy.

- Udostępnianie kartoteki weterynarzowi (link / QR read-only, TTL, unieważnianie).
- Saldo prepaid i egzekwowanie kosztu analiz AI.
- Stripe — doładowania salda.

---

## Po MVP (kierunki, nie zobowiązania)

- Śledzenie trendów parametrów badań w czasie (potencjalny upsell).
- Aplikacje natywne iOS/Android (jeśli PWA okaże się niewystarczające).
- **Segment organizacyjny (v2):** fundacje i schroniska — role zespołowe, domy
  tymczasowe, adopcje, publiczne profile, ewidencja i raporty dla Inspekcji
  Weterynaryjnej, integracja z KROPiK. Szczegóły w `IDEAS.md`.

---

## Marketing przedlaunchowy (równolegle do M1–M2)

- Landing page + zapis na listę oczekujących. To ta sama warstwa publiczna, która
  po launchu rozrasta się o blog (patrz niżej) — nie budujemy dwóch osobnych landingów.
- Grupy na Facebooku dla właścicieli psów i kotów.
- TikTok / Instagram — krótkie video pokazujące odczyt wyników przez AI
  (efektowne i łatwe do pokazania); formaty z kotami, napisy, lektor AI, montaż w CapCut.

---

## Warstwa publiczna — blog (równolegle, po M1)

Blog na `caremypet.pl` prowadzony przez osobę contentową z zewnętrznego CMS (Sanity),
poza Supabase. Szczegóły techniczne w `TECH.md` (§8 „Warstwa publiczna").

**Kolejność:** rdzeń aplikacji (M1) ma pierwszeństwo. Blog nie może wyprzedzić ani
opóźnić MVP — infrastruktura contentowa wchodzi, gdy panel stoi. W konflikcie
priorytetów rozstrzyga dowiezienie MVP.
