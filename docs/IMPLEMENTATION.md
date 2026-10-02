# Fundament aplikacji — 2026-10-01

## Zakres pierwszego etapu

Strona główna według „06 — Care My Pet Signature”, tokeny, wspólne komponenty,
lokalne assety i fonty, responsywna nawigacja, publiczne demo Luny oraz podstawowe
trasy podstron. Nie jest to wdrożenie pełnego MVP ani integracja backendu.

Stan: `/login` informuje o przygotowaniu aplikacji i kieruje do demo, bez wzmianki
o zaproszeniach i bez obietnicy terminu otwarcia; `/app` jest zamknięte
przekierowaniem serwerowym. Prywatność i regulamin są oznaczonymi wersjami roboczymi.
Nie uruchomiono Supabase, płatności, AI, PWA, analityki ani hostingu.

## Organizacja

- `src/app`: routing i kompozycja stron. Grupy `(public)`, `(auth)`, `(private)`.
- `src/components/ui`: Button/ButtonLink, Card, Badge/Status.
- `src/components/layout`: Container, Section, nagłówek i stopka.
- `src/components/brand`: wspólny znak marki.
- `src/features`: komponenty marketingowe, dokumenty, kartoteka i wyniki.
- `src/fixtures/demo`: wyłącznie fikcyjne dane; nigdy fallback danych prywatnych.
- `src/lib`: fonty, ścieżki assetów i formatowanie liczb/dat.
- `src/styles`: skale, semantyczna paleta i style.
- `tests/e2e`: zachowanie użytkowe i dostępność przez Playwright + axe.

Domyślnie Server Components. Granice klienta tylko w menu i przełączaniu
kartoteki. Komponenty domenowe przyjmują typowane dane przez props.
UI nie importuje klienta bazy ani nie zawiera wywołań modeli AI.

## Decyzje techniczne

Next.js 16.3.8 / React 19.3.0 — wersje stabilne zweryfikowane przy inicjalizacji.
Dokumentacja wcześniej wskazywała Next.js 15, ale repo nie miało zależności.
Nowa aplikacja nie wymaga więc migracji istniejącego kodu. Lockfile jest źródłem
prawdy dla dokładnych wersji; Node.js 24 LTS, minimum 22.

Tailwind 4 jest skonfigurowany; wspólne style korzystają z semantycznych zmiennych CSS.
Nie instalujemy shadcn tylko dla prostego Button/Card. W przyszłości złożone
kontrolki mogą użyć jego mechaniki, zachowując tokeny Signature.

Fonty Plus Jakarta Sans i Inter są zmienne i lokalne (`next/font/local`, pakiety
Fontsource wraz z licencjami). Brak sieciowych żądań do Google Fonts przy buildzie.
Zdjęcia z referencji są serwowane lokalnie przez `next/image`, z responsywnymi
rozmiarami i negocjacją WebP/AVIF. Nie kopiujemy HTML/JS Stitch do aplikacji.

## Świadome korekty referencji

- Dostępne kontrasty tekstu przy zachowaniu palety (szczegóły w DESIGN.md).
- Brak CTA rejestracji; demo pod `/demo/luna`.
- Pełna nawigacja mobilna, klawiaturowe zakładki, semantyczne linki/przyciski.
- Status całego badania uwzględnia podwyższoną kreatyninę z referencji pełnej
  kartoteki; dane są współdzielone z podglądem na stronie głównej.
- Kroki importu są ilustracją. Nie sugerują działającego uploadu/zapisu w demo.
- Stopka używa aktualnego roku; odnośniki mają istniejące trasy.

## Dalsze etapy

1. Ocena pozostałych podstron względem ich zatwierdzonych ekranów.
2. Integracja Supabase Auth po stronie serwera, modelu gospodarstwa i RLS.
3. Podłączenie sprawdzonych PoC dokumentów i zatwierdzania ekstrakcji.
4. Historia, terminy i dokumenty z danych prywatnych; współdzielone komponenty
   prezentacyjne, oddzielne źródła danych demo i aplikacji.
5. Uzupełnienie dokumentów prawnych i dopiero potem udostępnienie kont.

Logika domenowa i sekrety AI pozostają w backendzie zgodnie z TECH.md.
Nie należy odblokowywać `/app` samym sprawdzeniem stanu po stronie klienta.

## Weryfikacja pierwszego etapu

- `npm run lint` — bez błędów.
- `npm run build` — udany build produkcyjny wraz z kontrolą TypeScript.
- `npm run test:e2e` — 12/12 testów na produkcyjnym serwerze: desktop i mobile.
- Sprawdzono klawiaturowe zakładki, menu mobilne, nawigację i FAQ,
  przekierowanie `/app`, ładowanie lokalnych zdjęć oraz brak poziomego overflow
  przy 320 i 390 px. Wyniki przechodzą z tabeli do kart na telefonie.
- Automatyczny axe: brak naruszeń objętych sprawdzanymi regułami na stronie
  głównej i zakładce wyników. Nie jest to deklaracja pełnego audytu WCAG.
- Wizualnie sprawdzono desktop i mobile przez agent-browser. Lokalna sesja
  nie zgłosiła błędów JavaScript. Zrzuty robocze: `tmp/implementation/` (ignorowane).

## Pełna kartoteka demonstracyjna — 2026-10-01

Skrócony podgląd pozostaje na stronie głównej. `/demo/luna` prezentuje pełną
kartotekę, a nawigacja prowadzi do osobnych stron: `/historia`, `/wyniki`,
`/dokumenty` pod tym adresem. Działają odnośniki bezpośrednie, odświeżanie i historia
przeglądarki. Aktywna strona ma `aria-current`; nie udajemy zakładek ARIA przy
nawigacji między osobnymi adresami.

### Referencje Stitch

Projekt: `1963478756572071889`. Odczytano ekran i eksport; nie zmieniano projektu.

| Widok | ID ekranu |
|---|---|
| Forest — Moja Luna — Profil i podsumowanie | `72bf93de4d4043ba9dec8591de4291c0` |
| Forest — Kartoteka Luny — Historia zdrowia | `4cadf06e1f7b4d18ad0a134b0f25d371` |
| Forest — Kartoteka Luny — Wyniki badań | `7cb450a3e2fb4067a1b191cedaf4aa0c` |
| Forest — Kartoteka Luny — Dokumenty | `b38ce998c55c441fa6df44d1cf5113bb` |
| Forest — Kartoteka Luny — Podgląd dokumentu (Modal) | `3cd433d55bc54064a4c9a0e976473e7d` |
| Forest — Mobile — Profil Luny (Telefon) | `7aa23c9f78af4ae3bee6f11915a03f69` |

Wariant „Dostępna i Przyjazna” miał uszkodzony podgląd. Wybrano ciepły profil
z dużym zdjęciem, tłem koca i notatką opiekuna. Na szczegółowych zakładkach
nagłówek jest kompaktowy. Kolory, fonty, komponenty i semantyka statusów pozostają
zgodne z Signature; pastelowe powierzchnie kart statystyk pochodzą ze wzorca profilu.

### Funkcje i granice demo

- Podsumowanie: statystyki, ostatnie wydarzenia, wyniki, wykres wagi i dokumenty.
- Historia: wyszukiwanie, filtry kategorii, rozwijane szczegóły, dokumenty powiązane.
- Wyniki: sześć parametrów, zakresy i poprzednie wartości, filtry grup,
  wykres kreatyniny, tabela desktop / karty mobile.
- Dokumenty: pięć przykładów, wyszukiwanie i kategorie, podgląd w natywnym dialogu.
  Parametr `?plik=badania` umożliwia bezpośrednie otwarcie. Escape zamyka dialog,
  fokus wraca do wywołującego linku. Można przechodzić do kolejnych dokumentów.
- Podglądy dokumentów to dostępny HTML z danych demonstracyjnych, nie rzeczywiste
  PDF-y kliniki. Nie dodano pozornych przycisków pobierania, ZIP ani uploadu.
- Nie przeniesiono danych prawdziwego opiekuna, podpisów, numerów uprawnień,
  certyfikatów ani niezweryfikowanych obietnic bezpieczeństwa z eksportu Stitch.
- Wspólne dane: `src/fixtures/demo/luna-record.ts`; landing, wyniki, historia
  i podgląd dokumentu korzystają z tej samej informacji o badaniach.
- Komponenty przyjmują typowane dane. Demo nie korzysta z backendu i nie wykonuje
  zapisów. Integracja prywatnych danych nadal wymaga osobnej warstwy dostępu i RLS.

### Sprawdzenie

Build produkcyjny z TypeScript i ESLint przeszły. 20/20 testów Playwright:
desktop/mobile, filtry i puste stany, nawigacja, dialog i fokus, wszystkie widoki
kartoteki w axe oraz szerokość 320 px. Automatyczne testy nie zastępują pełnego
audytu dostępności. Podgląd testowano na osobnym porcie 3100, bez zatrzymywania
serwera użytkownika. Można użyć `PLAYWRIGHT_PORT` do wskazania portu testów.
