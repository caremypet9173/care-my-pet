# Assets marki — Care My Pet

Źródłowe pliki graficzne marki. Docelowe, zweryfikowane webowo pliki (favicon,
ikony PWA, obrazki w `<img>`) trafią do `public/` dopiero po scaffoldingu Next.js
(M1) — tu trzymamy źródła i pliki robocze do dalszej obróbki.

Decyzje o systemie znaków i kolorach: [`docs/DESIGN.md`](../../docs/DESIGN.md).

## Co tu jest

`full-mark/<motyw>/` — pełne logo (pies, kot, króliki, dłoń, łapa, bursztynowe
serce):

- `care-my-pet-full-mark-<motyw>.png` — sam znak, bez wordmarku
- `care-my-pet-full-lockup-<motyw>.png` — znak + wordmark „Care My Pet” pod spodem
- `care-my-pet-full-lockup-<motyw>-dark.png` — to samo, ale wordmark w jasnym
  kolorze zamiast domyślnego ciemnozielonego. **Do użycia na ciemnym tle** —
  patrz sekcja „Dark mode” niżej.

Motywy: `forest/` (oryginał AI), `teal/`, `terracotta/` (przytłumione
nasycenie — patrz „Historia decyzji” niżej).

`icon/pictorial/<motyw>/` — ikona (favicon, PWA, awatary), zgodna z DESIGN.md §1:
pies i kot trzymani w dłoni, bursztynowe serce w centrum, bez królików, bez
łapy nad kołem. **Jedyna wersja ikony, używana we wszystkich rozmiarach**
(512/192/180/32/16 + `1024` master do re-eksportów):

- `care-my-pet-icon-pictorial-<motyw>-{1024,512,192,180,32,16}.png`
- Motywy: `forest/`, `teal/`, `terracotta/` (przytłumione nasycenie)
- **Świadomy kompromis:** przy 32/16 px zwierzęta zlewają się w kształt (serce
  zostaje rozpoznawalne). Testowana była osobna, w pełni czytelna wersja bez
  zwierząt (samo koło + serce) — odrzucona na rzecz spójnego znaku we
  wszystkich rozmiarach. Patrz DESIGN.md §1.

`tools/` — skrypty PowerShell użyte do wygenerowania teal/terracotta z motywu
forest. To jest **źródło prawdy** dla przyszłych motywów — edytuj skrypty, nie
wynikowe PNG:

- `gradient-map.ps1` — rekoloruje `icon/` z pliku bw (mapa jasności → kolor),
  według stałych progów jasności skalibrowanych empirycznie dla kompozycji
  pictorial (0=obrys, 72=pies, 144-152=dłoń, 168-176=serce, 192-216=kot,
  248=połysk). Działa tylko gdy plik bw jest pixel-wyrównany ze źródłem
  kolorowym (patrz niżej). Użycie:
  `gradient-map.ps1 -SrcPath <bw.png> -OutPath <out.png> -Theme teal|terracotta|terracotta-muted`
- `hue-rotate.ps1` — rekoloruje `full-mark/` bezpośrednio z pliku kolorowego
  (obrót odcienia HSL: zielenie → nowy odcień primary, pomarańcz serca → nowy
  odcień accent, zachowuje oryginalną jasność/nasycenie). Użyty tu, bo plik bw
  dla pełnego logo **nie jest** pixel-wyrównany ze źródłem kolorowym (osobna
  generacja AI) — mapa jasności by się rozjechała. Użycie:
  `hue-rotate.ps1 -SrcPath <color.png> -OutPath <out.png> -GreenTargetHue <deg> -OrangeTargetHue <deg> [-GreenSatScale 1.0] [-OrangeSatScale 1.0]`
- `resize-set.ps1` — z pliku 1024px generuje komplet 512/192/180/32/16
  (bicubic, System.Drawing). Użycie:
  `resize-set.ps1 -SrcPath1024 <src.png> -OutDir <dir> -Prefix <nazwa>`
- `dark-wordmark.ps1` — zmienia kolor tekstu wordmarku na jasny (tylko w dolnym
  pasie obrazu, `-TextRegionYStart` w pikselach — reszta znaku zostaje bez
  zmian). Użycie:
  `dark-wordmark.ps1 -SrcPath <lockup.png> -OutPath <out.png> -TextRegionYStart 945 [-LightHex F2EFE6]`

Docelowe odcienie (stopnie HSL) użyte dla `hue-rotate.ps1`, wyliczone z hex
tokenów w DESIGN.md §3: teal primary→177.4°, teal accent→6.94°; terracotta
primary→136°, terracotta accent→15°.

## Historia decyzji: terracotta

Pierwsza wersja przenosiła nasycenie 1:1 z oryginalnej grafiki AI (dość żywe,
niezgodne z opisem „stonowany, ziemisty” z DESIGN.md §3). Wygenerowano drugą
wersję z przytłumionym nasyceniem (`-GreenSatScale 0.55 -OrangeSatScale 0.85`
w `hue-rotate.ps1` / `gradient-map.ps1`) — **wybrana i obowiązująca**. Wersja
nasycona 1:1 została usunięta z repo (nie zostawiona jako alternatywa).

## Dark mode

Test na prowizorycznym ciemnym tle (`#0B1F16` — nie jest oficjalnym tokenem,
DESIGN.md §5 wciąż nie ma zdefiniowanych tokenów `surface`/`text`/`border` dla
trybu ciemnego):

- **Znak i ikona są dark-mode-safe bez zmian** — kolory czytelne na ciemnym
  tle, nic nie trzeba przerabiać.
- **Wordmark nie jest** — domyślny ciemnozielony tekst prawie znika na ciemnym
  tle. Stąd `*-dark.png` (jasny tekst) dla każdego motywu.
- To rozstrzyga tylko kolor znaku/tekstu, nie cały temat ciemnego motywu —
  faktyczne tokeny tła/powierzchni/obramowań dla UI wciąż czekają na decyzję
  (DESIGN.md §5).

## Wektor (SVG) — świadomie pominięty

`full-mark/` i `icon/pictorial/` są tylko rastrowe (PNG) — to decyzja, nie
zaległość: brak materiałów drukowanych i innych zastosowań wymagających
skalowania poza gotowe rozmiary, więc wektoryzacja nie wnosi wartości. Źródłem
prawdy dla kolorów i rozmiarów są skrypty w `tools/`. Zmiana samej kompozycji
(kształtów psa/kota/serca), a nie koloru, nadal wymagałaby nowej generacji AI.
