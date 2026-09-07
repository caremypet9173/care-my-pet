# MONETIZATION — Model płatności

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
**Status:** Aktywny
**Powiązane:** PRD.md, TECH.md

---

## 1. Filozofia

Projekt nie jest nastawiony na maksymalizację zysku. Cel: pokrycie kosztów
infrastruktury i operacyjnych oraz margines na dalszy rozwój.

---

## 2. Model — prepaid usage-based

Odrzucamy subskrypcję i freemium na rzecz **przedpłaconego salda**:

- Użytkownik doładowuje saldo, które maleje wraz z użyciem płatnych funkcji.
- **Saldo przypisane do konta** (nie do konkretnego zwierzaka) — środki można
  wykorzystać na dowolnego pupila.
- **Saldo bezterminowe** — środki nie przepadają.
- Jedna płaska cena, bez widocznych progów jakości.

### Co jest darmowe
Trzon aplikacji: profil zwierzaka, historia medyczna, szczepienia i profilaktyka
z przypomnieniami, kalendarz wizyt, powiadomienia, konta rodzinne.

### Co jest płatne
Zasoby zużywające realnie AI — przede wszystkim **analiza dokumentu z wynikami
badań przez AI**, orientacyjnie **~0,5 EUR za analizę**.

*(Otwarte: czy asystent konwersacyjny też schodzi z salda, czy jest darmowy w
rozsądnym zakresie — patrz §5.)*

### Dlaczego prepaid, a nie subskrypcja
Duża część docelowych użytkowników to opiekunowie okazjonalni: jeden zwierzak,
kontrola 2–3× w roku plus szczepienia. Comiesięczna subskrypcja jest dla nich
nieatrakcyjna i podnosi barierę wejścia. Prepaid pozwala płacić dokładnie za to,
co się zużyło, i nie karze rzadkiego użycia.

---

## 3. Podstawa kosztowa

Skrypt `koszt_analizy.py` potwierdził, że **koszt API na analizę nie jest istotnym
ograniczeniem cenowym** — marża przy ~0,5 EUR za analizę jest zdrowa. Koszt AI
skaluje się liniowo z użyciem, więc prepaid naturalnie pokrywa własny koszt
zmienny; koszty stałe (Supabase, Vercel, domena, email transakcyjny) są niskie i
przewidywalne.

Wolumen AI należy monitorować od pierwszych użytkowników.

---

## 4. Płatności i darowizny

- **Operator płatności:** Stripe (doładowania salda) — wchodzi w M3, patrz ROADMAP.
- **Darowizny:** opcjonalne, nie odblokowują funkcji — czyste wsparcie projektu.

---

## 5. Otwarte pytania

1. Czy asystent AH (poza analizą dokumentów) schodzi z salda, czy jest darmowy w
   rozsądnym limicie?
2. Jaka konkretna kwota za analizę i jakie nominały doładowań (np. 10 / 25 / 50 zł)?
3. Jak zachęcić użytkownika okazjonalnego do pierwszego doładowania — darmowa
   pierwsza analiza na start?
4. Czy wprowadzać śledzenie trendów parametrów w czasie jako osobny płatny upsell?
