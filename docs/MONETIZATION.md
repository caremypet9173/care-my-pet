# MONETIZATION — Model płatności

**Wersja:** 0.2 (MVP / pilotaż)
**Data:** 2026-09-28
**Status:** Aktywny
**Powiązane:** PRD.md, TECH.md

---

## 1. Filozofia

**Etap bieżący: cichy pilotaż.** Poniższy prepaid i cennik opisują model docelowy.
Stripe i publiczny cennik nie są warunkiem testów na czterech kotach Wojtka ani
udostępnienia serwisu przyjaciołom. Budżet pilotażu i to, kto pokrywa użycie AI,
pozostają do ustalenia. Od początku mierzymy zużycie i egzekwujemy limity kosztowe;
brak płatności nie oznacza nieograniczonego użycia.

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

### Co jest płatne — cennik

Dwa zasoby zużywające realnie AI schodzą z tego samego salda:

| Zasób | Cena z salda |
|---|---|
| Analiza dokumentu z wynikami badań (AI) | ~0,5 EUR / analiza |
| Zapytanie do asystenta ponad dzienny limit | 0,01 EUR / zapytanie |

Asystent konwersacyjny jest **darmowy do 20 wiadomości dziennie**; dopiero
nadwyżka ponad limit schodzi z salda po 0,01 EUR za zapytanie. Rozliczenie jest
**za pojedyncze zapytanie**, nie za paczkę — prostsze księgowanie salda i brak
zmuszania użytkownika do kupowania z góry. Limit 20/dzień to parametr do rewizji
po pierwszych danych o użyciu; w razie potrzeby pulę można podnieść bez zmiany
modelu.

**Do weryfikacji przy implementacji:** realny koszt zapytania asystenta należy
zmierzyć tak samo jak koszt analizy (`koszt_analizy.py`), żeby potwierdzić, że
0,01 EUR jest nad kosztem z marżą.

### Dlaczego prepaid, a nie subskrypcja
Duża część docelowych użytkowników to opiekunowie okazjonalni: jeden zwierzak,
kontrola 2–3× w roku plus szczepienia. Comiesięczna subskrypcja jest dla nich
nieatrakcyjna i podnosi barierę wejścia. Prepaid pozwala płacić dokładnie za to,
co się zużyło, i nie karze rzadkiego użycia.

---

## 3. Podstawa kosztowa

Wcześniejsze obliczenia w `koszt_analizy.py` wskazywały na zapas względem ceny
~0,5 EUR za analizę. To historyczne założenie do potwierdzenia w pilotażu na
aktualnych modelach i rzeczywistych dokumentach, wraz z kosztami ponowień.
Koszt darmowej puli asystenta trzeba liczyć także dla kont bez doładowań.

Hosting pilotażu wybrany: Vercel + Supabase managed (`HOSTING.md`).
Uwzględniamy hosting aplikacji, bazę, pliki i ich backup, administrację, domenę,
pocztę oraz AI. Na start Vercel Hobby + Supabase Cloud Free: 0 USD za plany
w ich limitach, koszty AI i pozostałych usług osobno. Płatne warianty w HOSTING.md
służą porównaniu na przyszłość, nie są wymaganiem pilotażu.

Wolumen AI należy monitorować od pierwszych użytkowników.

---

## 4. Płatności i darowizny

- **Operator płatności:** Stripe (doładowania salda) — etap P4 przed płatnymi usługami, patrz ROADMAP.
- **Darowizny:** opcjonalne, nie odblokowują funkcji — czyste wsparcie projektu.

---

## 5. Otwarte pytania

1. Jaka konkretna kwota za analizę i jakie nominały doładowań (np. 10 / 25 / 50 zł)?
2. Jak zachęcić użytkownika okazjonalnego do pierwszego doładowania — darmowa
   pierwsza analiza na start?
3. Czy wprowadzać śledzenie trendów parametrów w czasie jako osobny płatny upsell?
