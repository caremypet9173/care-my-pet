# ROADMAP

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
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

- Landing page + zapis na listę oczekujących (Supabase).
- Grupy na Facebooku dla właścicieli psów i kotów.
- TikTok / Instagram — krótkie video pokazujące odczyt wyników przez AI
  (efektowne i łatwe do pokazania); formaty z kotami, napisy, lektor AI, montaż w CapCut.
