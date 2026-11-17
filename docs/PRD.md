# PRD — Care My Pet

**Wersja:** 0.4 (MVP / cichy pilotaż — aktualizacja do stanu wdrożenia)
**Data:** 2026-11-17
**Status:** Aktywny
**Powiązane:** TECH.md, MONETIZATION.md, ROADMAP.md

---

## 1. Cel produktu

Care My Pet to aplikacja do zarządzania zdrowiem zwierzaka dla **właściciela
prywatnego** (i jego rodziny). Centralne miejsce na dane psa/kota: profil,
historia medyczna, szczepienia, wizyty, wyniki badań, pomiary życiowe, leki i
płynoterapia — plus asystent AI, który odczytuje wyniki z dokumentów i odpowiada
na pytania o historię pupila.

### Problemy, które rozwiązujemy
- Dane o zwierzaku rozproszone po kartkach, mailach od weta i PDF-ach z wynikami.
- Zapominanie o terminach: szczepienia, odrobaczanie, wizyty kontrolne, pory podania leków i kroplówek.
- Brak szybkiego dostępu do historii zdrowia w gabinecie weterynaryjnym.
- Ręczne przepisywanie wyników badań i wypisów z papieru/PDF do ewidencji.

### Kogo NIE obsługujemy w MVP
Fundacji, schronisk i organizacji prozwierzęcych. Ten segment (role zespołowe,
domy tymczasowe, adopcje, ewidencja ustawowa) jest realny, ale świadomie
odłożony do v2 — patrz `IDEAS.md`.

### Sposób uruchomienia — cichy pilotaż

Najpierw Wojtek używa serwisu dla swoich czterech kotów i obszernego zbioru
prawdziwych badań. Następnie zaprasza przyjaciół. Dostęp do pilotażu jest
kontrolowany w bazie (`pilot_whitelist`); każdy znajomy ma własne gospodarstwo,
chyba że został świadomie zaproszony do wspólnej opieki.

### Strona główna i warstwa publiczna

Publiczna strona główna działa według projektu „06 — Care My Pet Signature”
wraz z pełną kartoteką demonstracyjną `/demo/luna`. Blog, SEO i kampania
pozyskania użytkowników są odłożone do decyzji o szerszym otwarciu (`TECH.md` §8).

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

Aplikacja **web (PWA)** — responsywna od 320px wzwyż, z powiadomieniami push
i instalowalnością na ekranie głównym. Brak natywnych aplikacji iOS/Android w MVP.

---

## 4. Model konta i role

| Rola | Uprawnienia |
|---|---|
| **Właściciel (admin)** | Pełen dostęp; dodaje/usuwa zwierzęta i zarządza członkami gospodarstwa |
| **Współopiekun (członek)** | Dostęp do wszystkich zwierząt w gospodarstwie, dodawanie i edycja wpisów opieki |

Każdy wpis podpisany autorem i datą (kto i kiedy dodał/zmienił).

---

## 5. Funkcje MVP

### 5.1 Profil zwierzaka i nawigacja
- Imię, gatunek (pies/kot), rasa, data urodzenia (z oznaczeniem daty przybliżonej),
  płeć, kastracja/sterylizacja.
- Prywatny awatar z lokalnym kadrowaniem (JPEG 512×512).
- **Numer chipa / tatuaż** — pole standardowe pod przyszły KROPiK.
- **Tagi opiekuńczo-zdrowotne** (`tagi`, do 8 na pupila): krótkie hasła widoczne
  od razu w hero, na pulpicie i w karcie leczenia (np. `onkologiczna`, `nerkowiec`,
  `cukrzyca`, `stres u weta`), z podpiętym słownikiem podpowiedzi oraz własnym wpisem.
- **„Parę słów o mnie”** (pole `notatki`): dłuższy opis otwierany z hero przez
  przycisk i modal **„O mnie”** (ukryty, gdy opis jest pusty).
- **Szybki przełącznik kartotek (`PetSwitcher`):** w szczegółach pupila pasek
  pigułek (do 5 pupili na desktopie) lub dropdown (> 5 i na mobile), zachowujący
  aktywną zakładkę.

### 5.2 Pomiary zdrowia i płynoterapia
- **Waga:** historia pomiarów, różnica względem poprzedniego wpisu i wykres trendu.
- **Parametry życiowe:** ciśnienie krwi (z klasyfikacją ACVIM/IRIS), glukoza i temperatura.
- **Płynoterapia (kroplówki):** rejestracja wlewów (płyn, objętość, droga podania,
  miejsce, leki dodane do wlewu) oraz harmonogramy cykliczne zsynchronizowane z
  Dziennym planem opieki.

### 5.3 Historia medyczna, szczepienia i profilaktyka
- Wizyty weterynaryjne, choroby, zabiegi, leki i profilaktyka z załącznikami (PDF / JPG / PNG)
  oraz opcjonalnym odczytem AI z załącznika.
- Rejestr szczepień, odrobaczania i odpchlania z datami następnych terminów.

### 5.4 Leki i Dzienny plan opieki
- Harmonogramy leków (jednorazowe, codzienne, interwałowe, wiele pór dziennie)
  i cyklicznej płynoterapii z śledzeniem zapasu leku.
- **Dzienny plan opieki** w kartotece pupila (odhaczanie podań/pominięć w czasie
  rzeczywistym przez Supabase Realtime z podpisem autora).
- **Karta leczenia** do wydruku/PDF dla weterynarza (`TreatmentSummaryModal`).

### 5.5 Kalendarz wizyt i powiadomienia
- Wspólny kalendarz gospodarstwa i kalendarz pupila (widoki: dzień, tydzień, miesiąc, agenda).
- Powiadomienia Web Push (VAPID) i e-mail (SMTP, także na dodatkowe adresy odbiorców
  przypisane do terminu).

### 5.6 Asystent AI
- Wielowątkowy czat oparty o RAG (`pgvector`) i pełny kontekst kartoteki
  (profil z tagami, badania, historia, waga, ciśnienie, glukoza, temperatura,
  leki, płynoterapia, terminarz).
- Eksport podsumowań rozmowy do PDF dla opiekuna i weterynarza.
- **Limit i zabezpieczenia kosztowe (twarde w kodzie):** `DAILY_MESSAGE_LIMIT = 20`
  wiadomości/dzień (docelowo nadwyżka 0,01 EUR z salda po uruchomieniu płatności —
  patrz `MONETIZATION.md`), cap wejścia `MAX_MESSAGE_CHARS = 800` znaków,
  cap wyjścia `MAX_OUTPUT_TOKENS = 1200`.
- **Ograniczenie zakresu:** system prompt trzyma asystenta przy temacie zdrowia i
  opieki nad zwierzakiem i odmawia zadań spoza domeny.

### 5.7 Odczyt wyników badań i kart wypisowych przez AI *(docelowo płatna — patrz MONETIZATION.md)*
Użytkownik wrzuca plik z wynikami lub wypisem (PDF / JPG / PNG). System:
- **Ekstrakcja** — odczytuje parametry laboratoryjne, opisy obrazowe (USG/TK/RTG)
  lub całe karty wypisowe (import batchowy wielostronicowych PDF).
- **Detekcja duplikatów** po haszu SHA-256 pliku przed wywołaniem AI.
- **Wstępna interpretacja i porównanie** — normalizacja nazw/jednostek oraz macierz
  porównawcza wyników w czasie.
- **Zasada zatwierdzania:** asystent nigdy nie zapisuje danych automatycznie.
  Każda wartość przechodzi przez ekran Split-Screen i wymaga potwierdzenia przez
  użytkownika przed zapisem.

### 5.8 Udostępnianie kartoteki weterynarzowi
- Tymczasowy link lub kod QR (ważność 1h / 24h / 7 dni, domyślnie 24h).
- Dostęp read-only w przeglądarce bez zakładania konta przez lekarza.
- Możliwość unieważnienia linku i historia otwarć.

### 5.9 Konta rodzinne
- Jedno gospodarstwo, wielu użytkowników (właściciel + współopiekunowie);
  zaproszenie linkiem/mailem.
- Historia zmian — wiadomo kto i kiedy dodał wpis lub podał lek.

---

## 6. User stories (priorytetowe)

| ID | Jako… | Chcę… | Żeby… |
|---|---|---|---|
| US-01 | Właściciel | Dodać profil psa/kota z tagami | Mieć wszystkie dane i kluczowe flagi pod ręką |
| US-02 | Właściciel | Zaplanować wizytę i leki | Nie zapomnieć o terminie ani dawce |
| US-03 | Właściciel | Dostać przypomnienie push/e-mail | Nie przegapić ważnego szczepienia lub kontroli |
| US-04 | Właściciel | Załączyć wyniki badań i wypisy | Mieć je pod ręką na kolejnej wizycie |
| US-05 | Właściciel | Wrzucić PDF z wynikami krwi lub TK | AI wyciągnęło dane do zatwierdzenia bez ręcznego przepisywania |
| US-06 | Właściciel | Wygenerować link/QR do kartoteki | Wet miał dostęp podczas wizyty bez rejestracji |
| US-07 | Właściciel | Zaprosić partnera do konta | Oboje mieli dostęp i odhaczali leki w czasie rzeczywistym |
| US-08 | Właściciel | Zapytać asystenta o historię | Szybko przeanalizować dane bez klikania po zakładkach |

---

## 7. Wymagania niefunkcjonalne

| Obszar | Wymaganie |
|---|---|
| Bezpieczeństwo | Dane szyfrowane w spoczynku i w transmisji (HTTPS) |
| Prywatność | Zgodność z RODO; prawo do usunięcia konta i danych |
| Izolacja danych | RLS w Supabase — każdy widzi tylko dane swojego gospodarstwa |
| PWA i responsywność | Web od 320px wzwyż, instalowalność PWA i obsługa offline w produkcji |
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

## 9. Kryteria pilotażu i późniejsze metryki

Najpierw mierzymy użyteczność na rzeczywistych danych:

- Czy można wygodnie prowadzić dokumentację wszystkich czterech kotów i odnaleźć wynik?
- Jak często odczyt AI wymaga korekty wartości, jednostki, daty lub przypisania do kota?
- Jaki jest czas i koszt analizy dokumentu (`private.ai_usage_log`), również przy błędzie i ponowieniu?
- Czy znajomi samodzielnie dodają pupila i badanie oraz wracają przy kolejnej potrzebie?
- Czy izolacja gospodarstw i odtworzenie bazy wraz z plikami zostały sprawdzone?

Wyniki i progi akceptacji ustalamy na podstawie pilotażu. Poniższe dawne cele
wzrostowe są hipotezą dla etapu publicznego; nie obowiązują jako kryteria cichego startu.

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
3. Kiedy rozszerzyć pilotaż na przyjaciół i jakie wyniki uzasadnią publiczne otwarcie?
4. Budżet AI i zasady finansowania użycia przez uczestników pilotażu przed wdrożeniem Stripe.
