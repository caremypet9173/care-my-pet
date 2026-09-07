# PRD — Care My Pet

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
**Status:** Aktywny
**Powiązane:** TECH.md, MONETIZATION.md, ROADMAP.md

---

## 1. Cel produktu

Care My Pet to aplikacja do zarządzania zdrowiem zwierzaka dla **właściciela
prywatnego** (i jego rodziny). Centralne miejsce na dane psa/kota: profil,
historia medyczna, szczepienia, wizyty i wyniki badań — plus asystent AI, który
odczytuje wyniki z dokumentów i odpowiada na pytania o historię pupila.

### Problemy, które rozwiązujemy
- Dane o zwierzaku rozproszone po kartkach, mailach od weta i PDF-ach z wynikami.
- Zapominanie o terminach: szczepienia, odrobaczanie, wizyty kontrolne.
- Brak szybkiego dostępu do historii zdrowia w gabinecie weterynaryjnym.
- Ręczne przepisywanie wyników badań z papieru do jakiejkolwiek ewidencji.

### Kogo NIE obsługujemy w MVP
Fundacji, schronisk i organizacji prozwierzęcych. Ten segment (role zespołowe,
domy tymczasowe, adopcje, ewidencja ustawowa) jest realny, ale świadomie
odłożony do v2 — patrz `IDEAS.md`.

---

## 2. Odbiorca

| Segment | Opis | Konto |
|---|---|---|
| Właściciel prywatny | Osoba opiekująca się psem lub kotem | Konto prywatne |
| Rodzina / gospodarstwo | Kilka osób współdzielących opiekę | Konto prywatne wieloosobowe |

**Obsługiwane gatunki (MVP):** pies i kot. Model danych przygotowany na
rozszerzenie o kolejne gatunki bez migracji łamiącej.

---

## 3. Platforma

Aplikacja **web (PWA)** — responsywna od 320px wzwyż, z powiadomieniami push i
dostępem offline do kart zwierząt. Brak natywnych aplikacji iOS/Android w MVP;
PWA pokrywa potrzebę mobilną na start.

---

## 4. Model konta i role

| Rola | Uprawnienia |
|---|---|
| **Właściciel (admin)** | Pełen dostęp; zarządza członkami gospodarstwa |
| **Członek** | Dostęp do wszystkich zwierząt w gospodarstwie, dodawanie wpisów |

Każdy wpis podpisany autorem i datą (kto i kiedy dodał/zmienił).

---

## 5. Funkcje MVP

### 5.1 Profil zwierzaka
- Imię, gatunek (pies/kot), rasa, data urodzenia, płeć, kastracja/sterylizacja.
- Galeria zdjęć; awatar z CTA do wgrania zdjęcia.
- Waga z historią pomiarów (wykres trendu domyślnie).
- **Numer chipa / tatuaż** — pole standardowe (nie opcjonalne), pod przyszły KROPiK.
- Notatki: alergie, charakter, zachowanie z innymi zwierzętami i dziećmi.

### 5.2 Historia medyczna
- Wizyty weterynaryjne: data, opis, diagnoza, lekarz/klinika.
- Choroby, zabiegi, operacje; historia leczenia i leków.
- Wyniki badań z załącznikami (PDF / JPG / PNG).

### 5.3 Szczepienia i profilaktyka
- Rejestr szczepień (nazwa, data, seria, weterynarz, następny termin).
- Rejestr odrobaczania i odpchlania (preparat, data, następny termin).
- Automatyczne przypomnienia z wyprzedzeniem (7 i 1 dzień przed terminem).

### 5.4 Kalendarz wizyt
- Planowanie wizyt; status: zaplanowana / odbyta / odwołana.
- Notatki przedwizytowe (objawy, pytania do weterynarza).

### 5.5 Powiadomienia
- Push (PWA) i email.
- Typy: nadchodząca wizyta, termin szczepienia, odrobaczanie, podanie leku.

### 5.6 Asystent AI
- Odpowiada na pytania o dane zwierzaka („Kiedy Burek był ostatnio u weta?").
- Pomaga uzupełnić profil („Dodaj szczepienie dla Filusi").
- Sugeruje, co przygotować przed wizytą, na podstawie historii.
- Informuje o zalecanych interwałach profilaktyki dla gatunku i wieku.

**Limit i płatność:** darmowy do **20 wiadomości dziennie**; po przekroczeniu
każde kolejne zapytanie schodzi z salda po **0,01 EUR** (patrz MONETIZATION).
Limit 20/dzień jest parametrem do rewizji po pierwszych danych o użyciu.

**Ograniczenie zakresu:** system prompt trzyma asystenta przy temacie zdrowia i
opieki nad zwierzakiem i odmawia zadań spoza domeny (ochrona przed „programowaniem"
na asystencie).

**Zabezpieczenie kosztowe (wymóg implementacyjny):** koszt zależy od tokenów, nie
od liczby wiadomości, więc obok limitu 20/dzień obowiązują dwa twarde capy:
- **Cap wejścia** — twardy limit długości pojedynczej wiadomości, walidowany w
  aplikacji **przed** wysłaniem do modelu (sam system prompt tego nie chroni —
  koszt nalicza się od tego, co użytkownik wysłał). Blokuje wklejanie ścian tekstu
  typu „odpowiedz na 100 pytań…".
- **Cap wyjścia** — `max_tokens` na odpowiedź, żeby ograniczyć koszt generacji.

Konkretne wartości capów ustalane przy implementacji (na podstawie typowej
długości realnych pytań).

### 5.7 Odczyt wyników badań przez AI  *(funkcja płatna — patrz MONETIZATION)*
Użytkownik wrzuca plik z wynikami (PDF / JPG / PNG / skan). System:
- **Ekstrakcja** — odczytuje parametry i wartości.
- **Walidacja norm** — porównuje z normami dla gatunku i wieku, flaguje odchylenia.
- **Streszczenie** — krótkie podsumowanie prostym językiem
  („Morfologia w normie, lekko podwyższona ALT").
- **Powiązanie z wizytą** — proponuje przypisanie wyników do wizyty po dacie.

**Zasada zatwierdzania:** asystent nigdy nie zapisuje danych automatycznie.
Każda wartość wymaga potwierdzenia przez użytkownika przed zapisem. To wprost
odpowiedź na ryzyko halucynacji przy danych medycznych.

### 5.8 Udostępnianie kartoteki weterynarzowi
- Jednorazowy link lub kod QR, ważność konfigurowalna (1h / 24h / 7 dni), domyślnie 24h.
- Dostęp read-only w przeglądarce, bez zakładania konta przez lekarza.
- Właściciel może ręcznie unieważnić link; historia otwarć (czas) widoczna.
- Zakres: profil, historia medyczna, wyniki, szczepienia i profilaktyka.

### 5.9 Konta rodzinne
- Jedno gospodarstwo, wielu użytkowników; zaproszenie mailem lub linkiem.
- Historia zmian — wiadomo kto i kiedy dodał wpis.

---

## 6. User stories (priorytetowe)

| ID | Jako… | Chcę… | Żeby… |
|---|---|---|---|
| US-01 | Właściciel | Dodać profil psa/kota | Mieć wszystkie dane w jednym miejscu |
| US-02 | Właściciel | Zaplanować wizytę | Nie zapomnieć o terminie |
| US-03 | Właściciel | Dostać przypomnienie o szczepieniu | Nie przegapić ważnego terminu |
| US-04 | Właściciel | Załączyć wyniki badań | Mieć je pod ręką na kolejnej wizycie |
| US-05 | Właściciel | Wrzucić PDF z wynikami krwi | AI wyciągnęło dane bez ręcznego przepisywania |
| US-06 | Właściciel | Wygenerować link/QR do kartoteki | Wet miał dostęp podczas wizyty bez rejestracji |
| US-07 | Właściciel | Zaprosić partnera do konta | Oboje mieli dostęp do danych zwierzaka |
| US-08 | Właściciel | Zapytać asystenta o historię | Szybko przeanalizować dane bez klikania po zakładkach |

---

## 7. Wymagania niefunkcjonalne

| Obszar | Wymaganie |
|---|---|
| Bezpieczeństwo | Dane szyfrowane w spoczynku i w transmisji (HTTPS) |
| Prywatność | Zgodność z RODO; prawo do usunięcia konta i danych |
| Izolacja danych | RLS w Supabase — każdy widzi tylko dane swojego gospodarstwa |
| Offline | Odczyt profili i historii bez połączenia; synchronizacja po powrocie sieci |
| Responsywność | Web od 320px wzwyż |
| Rozszerzalność | Model danych gotowy na kolejne gatunki i na segment organizacyjny (v2) |

---

## 8. Poza zakresem MVP (→ v2, `IDEAS.md`)

- Segment fundacji i schronisk (role zespołowe, domy tymczasowe, adopcje).
- Publiczne profile adopcyjne i wizytówka zwierzaka.
- Ewidencja i raporty dla Inspekcji Weterynaryjnej.
- Integracja z KROPiK (po uruchomieniu rejestru przez ARiMR).
- Konto weterynarza z prawem edycji przez link.
- Dyktowanie wyników głosem do asystenta.
- Sklep, rezerwacja wizyt online, integracje IoT, inne gatunki.
- Aplikacje natywne iOS/Android.

---

## 9. Metryki sukcesu (6 miesięcy)

| Metryka | Cel |
|---|---|
| Aktywni użytkownicy miesięcznie (MAU) | 1 000 |
| Średnia liczba zwierząt na konto | ≥ 1,5 |
| Retencja 30-dniowa | ≥ 40% |
| Konta z ≥ 1 analizą AI wyników | rosnący udział m/m |
| Ocena użytkowników | ≥ 4,2 / 5 |

---

## 10. Otwarte pytania

1. Jak aktywować użytkownika okazjonalnego (jeden zwierzak, 2–3 wizyty/rok)?
2. Powiadomienia SMS — potrzebne, czy push + email wystarczą na MVP?
3. Docelowy termin launchu MVP?
