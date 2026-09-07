# DESIGN — Identyfikacja wizualna

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
**Status:** Aktywny
**Powiązane:** TECH.md, PRD.md

---

## 1. Logo — system znaków

Marka używa **dwóch wersji znaku**, dobieranych wielkością. Nie miniaturyzuj
pełnego logo — w małych rozmiarach zlewa się w plamę (zweryfikowane testem 32 px).

| Wersja | Kiedy | Opis |
|---|---|---|
| **Pełne logo** | ≥ ~120 px — strona, nagłówek, materiały, prezentacje | Okrąg-uścisk: pies, kot, króliki, dłoń u dołu, łapa u góry, bursztynowe serce w centrum |
| **Ikona** | favicon, awatary (GitHub, social), ikona PWA, ikony aplikacji | Pełne ciemnozielone koło + jedno bursztynowe serce. Bez pierścienia, bez zwierząt |

**Wordmark:** „Care My Pet" — Plus Jakarta Sans, bold. **Bez tagline'u.**
W lockupie napis stoi po prawej od znaku. Przed użyciem produkcyjnym zamień tekst
na krzywe.

### Zasady
- Ikona ma **wypełnione koło**, nie pierścień — pierścień ginie poniżej 32 px.
- Serce to jedyny ciepły akcent i główna dominanta — nie osłabiaj go dodatkowymi
  elementami w wersji ikonowej.
- **Monogram (CMP / litery) nie jest częścią identyfikacji** — odrzucony
  świadomie; znak plus wordmark wystarczają.
- Cienkie detale (wąsy kota, palce dłoni) istnieją tylko w pełnym logo.
- Znak marki pozostaje **zielono-bursztynowy niezależnie od wybranego motywu UI**.

### Uwaga o zakresie
Pełne logo zawiera także króliki, choć MVP obsługuje wyłącznie psy i koty.
To świadoma decyzja — znak komunikuje szerszą obietnicę opieki nad zwierzętami
niż bieżący zakres aplikacji, a model danych jest przygotowany na kolejne gatunki.

### Eksport
Z ikony wygeneruj PNG w rozmiarach **512, 192, 180, 32, 16** (PWA i iOS wolą PNG
niż SVG). Sprawdzaj czytelność zawsze w 16 px, nie w 100%.

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
| Ciemny motyw | Nie zdefiniowany — wymaga osobnego przemyślenia kontrastów tekstu i powierzchni |
| Wybór motywu domyślnego po testach | Forest domyślnie; do weryfikacji na żywym UI |
| Czy motyw jest przełączalny przez użytkownika | Czy to ustawienie w aplikacji, czy tylko narzędzie deweloperskie |
| Kontrast WCAG | Każdy motyw zweryfikować pod kątem czytelności tekstu na tłach |
| Ikona powiadomień mobilnych | Ewentualny wariant z sylwetkami psa i kota |
