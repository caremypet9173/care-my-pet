# DESIGN — Identyfikacja wizualna

**Wersja:** 0.2 (Signature — fundament aplikacji)
**Data:** 2026-10-01
**Status:** Aktywny
**Powiązane:** TECH.md, PRD.md

---

## Wzorzec implementacyjny — decyzja 2026-10-01

Głównym źródłem prawdy dla wyglądu jest **„06 — Care My Pet Signature”**,
projekt Stitch `1963478756572071889`, ekran `b19e91a73daf435ba4c3d28e4130e215`.
Poniższa specyfikacja zastępuje wcześniejsze ustalenia Forest dotyczące kolorów,
fontów i kompozycji strony głównej. Wcześniejsze warianty zachowujemy jako historię
projektu, nie jako aktywne motywy aplikacji. Nie kopiujemy kodu eksportu Stitch.

### Tokeny i powierzchnie

Źródła implementacji: `src/styles/tokens.css` (wymiary i typografia),
`src/styles/themes.css` (role kolorów), `src/styles/globals.css` (style i układy).
Komponenty korzystają z tokenów CSS, a nie z lokalnych wartości HEX.

| Rola | Token | Signature |
|---|---|---|
| Tło strony | `--color-surface` | `#F8F6F1` |
| Karty | `--color-surface-raised` | `#FFFFFF` |
| Piaskowe panele | `--color-surface-sand` | `#F2EDE4` |
| Główna zieleń | `--color-primary` | `#1D4A40` |
| Akcent dekoracyjny | `--color-accent` | `#D97448` |
| Przycisk akcentowy | `--color-action-accent` | `#AE4F2C` |
| Mały tekst akcentowy | `--color-accent-text` | `#A64725` |
| Tekst | `--color-text` | `#14221D` |
| Tekst pomocniczy | `--color-text-muted` | `#4E5E57` |
| Obramowanie powierzchni | `--color-border` | `#EAE3DA` |
| Tekst pozytywnego statusu | `--color-success` | `#236B5B` |

Wyjątki względem eksportu służą czytelności: biały drobny tekst na `#D97448`
nie osiąga 4,5:1. Dlatego przycisk ma ciemniejszy terakotowy token, a dekoracje
zachowują kolor referencji. Analogicznie przyciemniono drobne teksty statusów.
Status zawsze ma opis słowny; „W zakresie” odnosi się do dokumentu, nie diagnozy.

### Typografia i wymiary

- Plus Jakarta Sans: nagłówki i treść; Inter: etykiety, przyciski i podpisy.
  Zastępuje wcześniejszy DM Sans. Fonty zmienne są serwowane lokalnie przez
  `next/font/local` z pakietów Fontsource; w czasie builda nie wymagają Google Fonts.
- Hero: 48 px desktop / 34 px mobile; sekcje: 32 / 26 px; karty: 20 px;
  treść: 15 px / 24 px, lead desktop: 18 px; podpisy zwykle 12 px.
- Odstępy: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px; w CSS jednostki rem.
- Promienie: 8 px (małe powierzchnie), 12 px (kontrolki), 16 px (karty),
  24 px (duże panele), pełne zaokrąglenie (badge).
- Kontener strony: maks. 1280 px z paddingiem; demo: 896 px treści;
  proza: 672 px treści. Marginesy boczne: 16 / 32 / 48 px.
- Sekcje: 40 px góra/dół, hero desktop: 64 px. Nagłówek: 64 px.
- Breakpointy układu: 640, 768, 1024 px; 1280 px to limit kontenera strony.
  Sprawdzamy również 320 px, 390 px i pośrednie szerokości.
- Hero: jedna kolumna, od 1024 px dwie. Karty historii i kroki: od 768 px trzy
  kolumny. Wyniki: tabela na desktopie, karty poniżej 768 px z tego samego modelu.
- Ikony interfejsu: Tabler. Logo: lokalna ikona PNG + poziomy wordmark w nagłówku;
  dotychczasowe pionowe lockupy pozostają materiałami marki.

### Komponenty i interakcje

`Button` / `ButtonLink`, `Card`, `Badge` / `Status`, `Container`, `Section`
stanowią podstawę stron i modułów aplikacji. Strony składają komponenty funkcjonalne
z `src/features`; warstwa UI nie pobiera danych z backendu.

Zakładki kartoteki obsługują strzałki oraz Home/End. Mobilna nawigacja ma opisany
stan rozwinięcia i zamykanie Escape. Fokus pozostaje widoczny, ilustracje kroków
nie udają działającego formularza. Ograniczamy ruch zgodnie z prefers-reduced-motion.

Treści pozostają zgodne z zamkniętym dostępem: brak rejestracji i naboru,
CTA prowadzi do `/demo/luna`. Strona `/login` informuje o przygotowaniu aplikacji,
bez wzmianki o zaproszeniach i bez obietnicy daty otwarcia:
„Jeszcze chwila. Przygotowujemy Care My Pet.” oraz
„Pracujemy nad miejscem, w którym dokumentacja Twojego pupila będzie zawsze pod
ręką. Tymczasem zobacz, jak może wyglądać jego kartoteka.”
Przycisk: „Zobacz przykładową kartotekę”. Po integracji logowania można dodać
„Masz już konto? Zaloguj się”; obecnie nie pokazujemy niedziałającej akcji.
Demo jest tylko do odczytu i używa wyłącznie fikcyjnych danych. Podsumowanie
badania uwzględnia kreatyninę powyżej zakresu — nie oznacza całego badania jako prawidłowe.
W pełnym demo i skróconym podglądzie używamy wspólnego raportu sześciu parametrów
z wzorca szczegółowej kartoteki (kreatynina 1,7 mg/dl, ALT 42 U/l).

Zdjęcia psa i kota oraz Luny pochodzą z zatwierdzonego ekranu i są przechowywane
lokalnie. Pochodzenie materiałów: `docs/ASSETS.md`. Podstrony korzystają z tych
samych komponentów; ich pierwsza implementacja nie stanowi osobnego, zatwierdzonego
wzorca wizualnego Stitch.

---

## Strona publiczna — decyzja 2026-09-29

Historyczną bazą strony głównej był projekt Stitch „Forest — Kompaktowe odstępy”.
Zachowujemy przytulne zdjęcie psa i kota w ramce, zwarte odstępy, przykładową
kartotekę i graficzne trzy kroki z widocznymi objaśnieniami. Teal i Terracotta
są alternatywnymi motywami tego samego układu.

Strona publiczna prezentuje produkt, ale nie prowadzi naboru do pilotażu:
- pozostają „Zobacz przykładową kartotekę” (do `/demo/luna`) i „Zaloguj się” (do `/login`);
- usuwamy wzmianki o pilotażu i dostępie na zaproszenie z hero oraz stopki;
- nie pokazujemy zapisów, listy oczekujących ani kontaktu do osoby zapraszającej;
- oznaczenia fikcyjnych danych przykładowych pozostają widoczne;
- na stronie logowania pokazujemy komunikat o przygotowaniu aplikacji, bez
  wzmianki o zaproszeniach (aktualizacja 2026-10-01). Szczegóły pilotażu
  przekazujemy bezpośrednio osobom testującym.

Sam pilotaż nadal jest zamknięty; zmienia się wyłącznie komunikacja publiczna.

### Podstrony publiczne

- `/mozliwosci` — możliwości produktu przedstawione na przykładach kartoteki,
  historii wizyt, wyników, wagi, terminów i odczytu dokumentów.
- `/jak-to-dziala` — dodanie dokumentu, porównanie odczytu z oryginałem,
  zatwierdzenie wpisu; ilustracje z objaśnieniami i krótkie FAQ.
- `/prywatnosc` — szablon dokumentu ze spisem sekcji i czytelną kolumną tekstu.
  Treść robocza wymaga uzupełnienia rzeczywistych danych administratora, kontaktu,
  podstaw przetwarzania, dostawców, retencji oraz używanych technologii przed publikacją.

Podstrony dziedziczą motyw Forest i kompaktowe odstępy ze wzorca. Przykłady
mają oznaczenia danych fikcyjnych. Nie obiecujemy bezbłędnego odczytu ani
diagnozy; użytkownik porównuje dane z dokumentem przed zatwierdzeniem.

### Przykładowa kartoteka

Publiczne demo `/demo/luna` przedstawia fikcyjną kartotekę Luny bez logowania.
To docelowe miejsce dla przycisku „Zobacz przykładową kartotekę”. Demo służy
do przeglądania przykładów; dodawanie własnych dokumentów pozostaje w aplikacji
po zalogowaniu. Nie prezentujemy fikcyjnych danych jako danych prawdziwego opiekuna.

Pełne demo wdrożone lokalnie 2026-10-01 korzysta z „Forest — Moja Luna — Profil
i podsumowanie” (`72bf93de4d4043ba9dec8591de4291c0`) oraz szczegółowych zakładek.
Układy dziedziczą tokeny Signature. Skrócony komponent pozostaje na stronie głównej.
Pod `/demo/luna` dostępne są podsumowanie, historia, wyniki i dokumenty — każdy
widok z własnym adresem. Lista referencji, różnice i zachowanie: `IMPLEMENTATION.md`.

### Wzorce mobilne

Wersje mobilne projektujemy w motywie Forest; Teal i Terracotta korzystają
z tego samego układu i komponentów, zmieniając kolory. Przy wdrożeniu należy
sprawdzić kontrast również w motywach alternatywnych.

Zakres szablonów: strona główna, podgląd wyników badań, Możliwości,
Jak to działa i Prywatność. Wzorcowa szerokość telefonu: 390 px.
Wyniki na telefonie przedstawiamy jako karty parametrów z wartością, jednostką,
zakresem z dokumentu i tekstowym statusem. Ilustracje kroków układamy pionowo
z objaśnieniami. Spis treści prywatności jest rozwijany nad dokumentem.
Podglądy Stitch nie zastępują testów responsywności i interakcji przy wdrożeniu.

## 1. Logo — system znaków

Marka używa **dwóch wersji znaku**, dobieranych wielkością.

| Wersja | Kiedy | Opis |
|---|---|---|
| **Pełne logo** | ≥ ~120 px — strona, nagłówek, materiały, prezentacje | Okrąg-uścisk: pies, kot, króliki, dłoń u dołu, łapa u góry, bursztynowe serce w centrum |
| **Ikona** | favicon, PWA install icon, apple-touch-icon, ikony sklepowe, awatary (GitHub, social) — wszystkie rozmiary: 512 / 192 / 180 / 32 / 16 px | Pies i kot trzymani w dłoni, bursztynowe serce w centrum. Bez królików, bez łapy nad kołem |

**Świadomy kompromis czytelności:** przy 32 i 16 px (favicon) ikona traci
część czytelności — pies i kot zlewają się w kształt, choć serce w centrum
pozostaje rozpoznawalne. Testowano osobną, uproszczoną wersję (samo koło +
serce, bez zwierząt) dla tych rozmiarów — decyzja: **niewarta rozjazdu
wizualnego między rozmiarami**, wolimy spójny znak wszędzie kosztem
czytelności w najmniejszym rozmiarze.

**Wordmark:** „Care My Pet" — Plus Jakarta Sans, bold. **Bez tagline'u.**
W lockupie napis stoi pod znakiem (wyśrodkowany).

**Wektor (SVG):** świadomie nie prowadzimy. Produkt nie ma materiałów
drukowanych ani zastosowań wymagających skalowania poza gotowe rozmiary
rastrowe — wszystkie miejsca użycia (favicon, PWA, apple-touch-icon, UI)
docelowo są PNG w stałych rozmiarach (patrz „Eksport" niżej). Źródłem prawdy
dla kolorów i rozmiarów są skrypty w `assets/brand/tools/`, nie plik wektorowy.

### Zasady
- Serce to jedyny ciepły akcent i główna dominanta — nie osłabiaj go dodatkowymi
  elementami w wersji ikonowej.
- **Monogram (CMP / litery) nie jest częścią identyfikacji** — odrzucony
  świadomie; znak plus wordmark wystarczają.
- Cienkie detale (wąsy kota, palce dłoni) istnieją tylko w pełnym logo.
- Ikona to uproszczenie pełnego logo (bez królików, bez łapy nad kołem), nie
  osobna kompozycja — zachowuje pozę psa, kota i dłoni z pełnego logo.
- Znak marki pozostaje **zielono-bursztynowy niezależnie od wybranego motywu UI**.

### Uwaga o zakresie
Pełne logo zawiera także króliki, choć MVP obsługuje wyłącznie psy i koty.
To świadoma decyzja — znak komunikuje szerszą obietnicę opieki nad zwierzętami
niż bieżący zakres aplikacji, a model danych jest przygotowany na kolejne gatunki.

### Eksport
Z ikony wygeneruj PNG w rozmiarach **512, 192, 180, 32, 16** (PWA i iOS wolą PNG
niż SVG). Sprawdzaj czytelność zawsze w rzeczywistym rozmiarze docelowym (16 px,
32 px), nie w 100% powiększeniu.

---

## 2. Kolory — zasada tokenów

UI budujemy **wyłącznie na tokenach semantycznych**, nigdy na wartościach
zapisanych na sztywno. W kodzie ma być `var(--color-primary)`, nigdy `#1D7A4F` —
inaczej przełączanie motywów wymaga przepisywania komponentów.

| Token | Rola |
|---|---|
| `--color-primary` | Główny kolor marki: nagłówki, przyciski główne, aktywne stany |
| `--color-primary-soft` | Jaśniejszy wariant: tła sekcji, hover, obramowania |
| `--color-accent` | Akcent: CTA, wyróżnienia, wskaźniki uwagi |
| `--color-surface` | Tło aplikacji |
| `--color-surface-raised` | Karty, panele, elementy wyniesione |
| `--color-text` | Tekst podstawowy |
| `--color-text-muted` | Tekst drugorzędny, podpisy |
| `--color-border` | Linie, obramowania, separatory |
| `--color-success` / `--color-warning` / `--color-danger` | Stany: wynik w normie / odchylenie / przekroczenie |

Stany (`success` / `warning` / `danger`) są **wspólne dla wszystkich motywów** —
w aplikacji medycznej znaczenie koloru nie może zależeć od wybranego motywu.

---

## 3. Motywy — archiwum sprzed Signature

Wcześniej rozważane trzy motywy. W implementacji domyślny jest Signature opisany
na początku dokumentu; poniższe palety nie są obecnie udostępnione użytkownikowi.

### 3.1 Forest *(domyślny)*
Zieleń z bursztynem. Najwyższy kontrast, spójny ze znakiem marki.

| Token | Wartość |
|---|---|
| `primary` | `#1D7A4F` |
| `primary-soft` | `#5AB98C` |
| `accent` | `#BA7517` (jaśniejszy: `#E09020`) |
| `surface` | `#faf8f5` |
| `surface-raised` | `#FFFFFF` |
| `text` | `#0F3D28` |
| `text-muted` | `#4A6B5A` |
| `border` | `#D9E4DC` |

### 3.2 Teal
Morska zieleń z koralem. Bardziej „appowy", nowocześniejszy, chłodniejszy.

| Token | Wartość |
|---|---|
| `primary` | `#126E6A` |
| `primary-soft` | `#7CC9A6` |
| `accent` | `#F2705F` |
| `surface` | `#faf8f5` |
| `surface-raised` | `#FFFFFF` |
| `text` | `#0E3B39` |
| `text-muted` | `#4C6E6C` |
| `border` | `#D7E5E3` |

### 3.3 Terracotta
Zieleń z ceglastym. Cieplejszy i bardziej naturalny. **Uwaga:** ceglasty i zieleń
mają zbliżoną jasność — pilnuj kontrastu tekstu na akcencie.

| Token | Wartość |
|---|---|
| `primary` | `#3E6B4A` |
| `primary-soft` | `#9DBBA0` |
| `accent` | `#C05A38` |
| `surface` | `#faf8f5` |
| `surface-raised` | `#FFFFFF` |
| `text` | `#2C4433` |
| `text-muted` | `#5D7563` |
| `border` | `#DCE3DA` |

### Stany (wspólne)
| Token | Wartość |
|---|---|
| `success` | `#2E7D5B` |
| `warning` | `#C98A16` |
| `danger` | `#C0392B` |

---

## 4. Typografia — archiwum sprzed Signature

- **Nagłówki / display:** Plus Jakarta Sans (bold, semibold)
- **Tekst:** DM Sans (zastąpiony zestawem Signature opisanym wyżej)
- Ikony: Tabler Icons (nie emoji)

---

## 5. Do ustalenia

| Temat | Uwagi |
|---|---|
| Ciemny motyw (tokeny UI: surface/text/border) | Nie zdefiniowany — wymaga osobnego przemyślenia kontrastów tekstu i powierzchni. **Znak marki i ikona są już zweryfikowane jako dark-mode-safe** (czytelne na ciemnym tle bez zmian) — patrz `assets/brand/README.md`. Wordmark ma osobny wariant z jasnym tekstem (`*-dark.png` per motyw), bo domyślny ciemnozielony ginie na ciemnym tle. Kolor tła użyty do testu (`#0B1F16`) jest prowizoryczny, nie jest oficjalnym tokenem |
| Motyw domyślny | Signature; wcześniejsze warianty są archiwalne |
| Czy motyw jest przełączalny przez użytkownika | Czy to ustawienie w aplikacji, czy tylko narzędzie deweloperskie |
| Kontrast WCAG | Każdy motyw zweryfikować pod kątem czytelności tekstu na tłach |
| Ikona powiadomień mobilnych | Ewentualny wariant z sylwetkami psa i kota |
