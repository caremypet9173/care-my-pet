# DESIGN — Identyfikacja wizualna

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
**Status:** Aktywny
**Powiązane:** TECH.md, PRD.md

---

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

## 3. Motywy

Trzy motywy do przetestowania na żywo. **Forest** jest domyślny — zgodny z logo.

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

## 4. Typografia

- **Nagłówki / display:** Plus Jakarta Sans (bold, semibold)
- **Tekst:** DM Sans
- Ikony: Tabler Icons (nie emoji)

---

## 5. Do ustalenia

| Temat | Uwagi |
|---|---|
| Ciemny motyw (tokeny UI: surface/text/border) | Nie zdefiniowany — wymaga osobnego przemyślenia kontrastów tekstu i powierzchni. **Znak marki i ikona są już zweryfikowane jako dark-mode-safe** (czytelne na ciemnym tle bez zmian) — patrz `assets/brand/README.md`. Wordmark ma osobny wariant z jasnym tekstem (`*-dark.png` per motyw), bo domyślny ciemnozielony ginie na ciemnym tle. Kolor tła użyty do testu (`#0B1F16`) jest prowizoryczny, nie jest oficjalnym tokenem |
| Wybór motywu domyślnego po testach | Forest domyślnie; do weryfikacji na żywym UI |
| Czy motyw jest przełączalny przez użytkownika | Czy to ustawienie w aplikacji, czy tylko narzędzie deweloperskie |
| Kontrast WCAG | Każdy motyw zweryfikować pod kątem czytelności tekstu na tłach |
| Ikona powiadomień mobilnych | Ewentualny wariant z sylwetkami psa i kota |
