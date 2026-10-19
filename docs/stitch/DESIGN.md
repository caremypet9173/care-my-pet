# Design System: Care My Pet — panel domowy

Źródło: projekt Stitch `1963478756572071889`. Wzorce:
lista `55fb2fa4b794438984a9290ea6915e1a`, profil `72bf93de4d4043ba9dec8591de4291c0`.
Pusta lista ma OSOBNY wzorzec: `dd35e4425542464ab423d076d0c5a1eb`,
„Forest — Pulpit Domowy (Brak pupili — Empty State)” (użytkownik: „Pusta Lista pupili”).
Przy zerowej liczbie zwierząt nie używać siatki z kafelkiem „Dodaj kolejnego pupila”.
Wyświetlać pełnej szerokości panel z ikoną marki, etykietą początku opieki,
wyśrodkowanym nagłówkiem, CTA utworzenia kartoteki, linkiem do demo Luny
i trzema małymi kafelkami informacyjnymi. Podsumowania mają neutralne ikony.
Pusty terminarz ma wyśrodkowaną ikonę i komunikat, bez przerywanej ramki.
Tokeny Signature: `b19e91a73daf435ba4c3d28e4130e215` i `../DESIGN.md`.
Istniejący projekt użytkownika ma pierwszeństwo przed domyślnymi zaleceniami
skilla StitchDesign dotyczącymi asymetrii, fontów i animacji.
Jeśli wybór szablonu jest niejasny, najpierw zapytać użytkownika.

## Logowanie i rejestracja

Obie trasy korzystają z „Forest — Ekran logowania i rejestracji”
(`3ba83b4082ce4583ae27cbc1ea89c97f`), wskazanego przez użytkownika.
Minimalny nagłówek i stopka, karta maks. 1024 px, desktop dwie kolumny 5:7.
Zielona kolumna: marka, hasło, trzy punkty i dolny panel. Biała kolumna:
przełącznik tras, nagłówek, Google/Apple, separator, formularz, informacje prawne.
Na telefonie jedna kolumna. Rejestracja zachowuje pole potwierdzenia hasła.
Różnice funkcjonalne: Apple nie jest skonfigurowane (wyłączone z opisem),
brak pozorowanych akcji odzyskania hasła i checkboxa zapamiętywania sesji.
Przykładową opinię zastępuje jawne zaproszenie do demonstracyjnego profilu Luny.
Przycisk podglądu hasła działa i ma dostępną nazwę oraz stan.

## Dodawanie pupila

Wskazane przez użytkownika ekrany „Poznajmy Twojego pupila”:

- Desktop: `c97db40601ca497e870acaf49d65f9b6`.
- Mobile: `e764c328c40a477ab9dfb023a5098025`.
- Dopasowanie zdjęcia: `43d89b91e02342abaf9895311c826153`.
- Desktop — walidacja (poglądowo): `4c7e11af773d410dad36809f768f5f59`.
- Desktop — wypełnienie (poglądowo): `d46a1094e0014d3393c0f72539e1fdc0`.
- Mobile — wypełnienie (poglądowo): `adacf35ab83545188f543b2e4cd69b39`.

API Stitch opisuje część tych ekranów jako „Forest — Dodawanie pupila”.
Identyfikatory odnoszą się do tego samego projektu, nie do podobnych szablonów.
Osobna strona z nagłówkiem, kartą i stopką akcji. Desktop: zdjęcie po lewej,
formularz po prawej. Mobile: jedna kolumna. Gatunek jako kafelki, płeć jako
przełącznik segmentowy, data z oznaczeniem przybliżenia, dodatkowe informacje
w rozwijanej sekcji. Zdjęcie opcjonalne; neutralny placeholder przed wyborem.
Dialog kadrowania ma okrągłą maskę, zoom, obrót i reset. Dodatkowe suwaki
przesunięcia zapewniają obsługę klawiaturą. Przykładowe dane Luny nie są
automatycznie wpisywane do profilu użytkownika.

## Rejestrowanie wagi — projektowanie ekranów

Uzgodniony przepływ: karta wagi w podsumowaniu → dialog dodawania pomiaru
→ historia z edycją. Jeden pomiar zawiera dodatnią wagę w kg, datę (domyślnie
dzisiaj, bez przyszłych dat) i opcjonalną notatkę. Każdy zapis tworzy osobny
pomiar. Karta pokazuje ostatni wynik, datę i neutralną zmianę względem
poprzedniego; wykres ma osie daty/kg. Nie oceniać wzrostu/spadku jako dobrego
lub złego, nie wymyślać docelowej masy. Pusta historia nie zawiera wykresu.
Dialog ma korzystać z proporcji i tokenów istniejącej edycji parametru
`28f38274a5db4a1b971bb3eb6149bc8b`, a hero z obecnej kartoteki Forest.
Etap: przygotowanie wzorców w Stitch; funkcja nie jest jeszcze zaimplementowana.

## Wyniki i weryfikacja badania

„Forest — Kartoteka Luny — Wyniki badań”: `7cb450a3e2fb4067a1b191cedaf4aa0c`.
„Forest — Kartoteka Luny — Weryfikacja odczytu badania (Split-Screen 2)”:
`4036ab7f7cfa47c3b1643e5cb81db90c` — identyfikator potwierdzony linkiem użytkownika.
Nie wybierać `8174984582f0439dbbe78024abd21d48`; API zwraca obie nazwy bez „2”.

Wyniki: zwarty nagłówek pupila, zakładki, wybór badania i filtry grup,
wykres trendu nad tabelą, źródło dokumentu. Weryfikacja: pasek procesu,
oryginał po lewej, nagłówek badania i edytowalne pomiary po prawej,
potwierdzenie przed zapisem. Na mobile jedna kolumna; tabela przewijana
we własnym kontenerze. Zachowane tokeny Signature i nagłówek tożsamości konta.
Nie kopiować fikcyjnej pewności odczytu „98%”, wyników Luny ani interpretacji.
Każdy pomiar wymaga sprawdzenia; zmiana wartości cofa jego potwierdzenie.
Oryginał PDF renderowany przez PDF.js ze stronami, zoomem i tekstem dostępności.
Granice implementacji i testów: `../MEDICAL_REPORTS.md`.

## 1. Visual Theme & Atmosphere

Ciepły, spokojny panel domowej opieki. Zwarte, czytelne informacje, nie landing.
Gęstość 6/10, asymetria 3/10, ruch 1/10. Białe powierzchnie na kremowym tle.
Nagłówek panelowy z marką, widocznym e-mailem konta, językiem i wylogowaniem.

## 2. Color Palette & Roles

- Krem `#F8F6F1`: tło.
- Biel `#FFFFFF`: karty, formularze, nagłówek.
- Piasek `#F2EDE4`: neutralne puste stany i etykiety.
- Głęboka zieleń `#1D4A40`: akcje, aktywna zakładka, stopka.
- Atrament `#14221D`: treść; szałwia `#4E5E57`: podpisy.
- Obramowanie `#EAE3DA`: separatory i krawędzie.
- Kolory semantyczne zachowane z tokenów projektu, bez diagnozowania na podstawie koloru.

## 3. Typography Rules

Plus Jakarta Sans i Inter z istniejącego systemu Signature. Nagłówek pulpitu
24–30 px, tytuły sekcji 16 px, etykiety 11–13 px. Profil: imię uppercase,
kontrolowana skala. Nazwy i e-mail muszą się zawijać, bez obcinania tożsamości.

## 4. Component Stylings

Pulpit: poziomy pasek czterech podsumowań. Karta pupila zawiera mały okrągły
portret lub ikonę zastępczą, imię i gatunek, pasek stanu dokumentacji,
wiersze faktów oraz pełnej szerokości przycisk kartoteki. Dodawanie: przerywana
krawędź, ikona plus, opis i etykieta akcji. Nie zastępować tego dużą samotną ikoną.

Profil: okładka z lokalnego `luna-cover.png`, jasny panel, prostokątne miejsce
na portret, imię, metadane, etykiety i notatka opiekuna. Zdjęcie Luny nie jest
zdjęciem rzeczywistego pupila użytkownika; przy braku zdjęcia stosować placeholder.
Zakładki z linią aktywnego wyboru, cztery kafelki, pod nimi szeroka kolumna
wydarzeń/badań oraz węższa kolumna wagi i danych podstawowych.

## 5. Layout Principles

Kontener 1280 px, odstępy 16/24/32 px. Lista: trzy kolumny zgodnie ze Stitch,
z dodawaniem jako kolejną kartą. Poniżej pełnej szerokości terminarz i nota.
Profil: kolumny 2.2:1. Poniżej 768 px jedna kolumna; żadnego poziomego przewijania.
Przyciski i zakładki mają minimum 44 px wysokości.

## 6. Motion & Interaction

Oszczędne przejścia hover i focus. Bez ciągłych pulsacji. Zakładki obsługują
strzałki, Home/End oraz role tab/tabpanel. Niedostępne moduły mają widoczny opis
„W przygotowaniu”. Nie sugerować, że wgranie dokumentu już działa.

## 7. Anti-Patterns

Edycja parametru: modal `28f38274a5db4a1b971bb3eb6149bc8b` (projekt
`1963478756572071889`). Szerokość 512 px, przyciemnione i rozmyte tło,
kremowy nagłówek i stopka, zielona informacja o źródle, dwie kolumny wyniku
i jednostki, granice zakresu, status, notatka i checkbox kluczowego parametru.
Nie przypisywać poziomu medycznego odchylenia ani strony PDF bez danych.
Przywracanie dotyczy pierwotnego zatwierdzonego odczytu, nie ponownego OCR.

Cała zakładka wyników korzysta z tego samego wzorca co tabela. Hero zachowuje
tło, portret 112 × 112 px, datę aktualizacji i prawą, kremową kartę notatki
opiekuna. Na telefonie notatka przechodzi pod dane. Nie ukrywać tych elementów
ani nie zastępować hero miniaturowym paskiem. Identyfikacja zawsze ma opis
(np. „Identyfikacja: brak”), nigdy samotne „Brak”. Nawigacja ma zaokrąglone
przyciski, a panel badań zawiera wybór badania, dostęp do źródła i filtry.
Wykres pokazuje rzeczywiste punkty z osiami i etykietami; brak historii ma jawny
stan pusty. Nie dopisywać nieistniejących informacji o alergiach ani masie.

Tabela wyników (`7cb450a3e2fb4067a1b191cedaf4aa0c`) ma pięć kolumn:
parametr z etykietą grupy, aktualny wynik z jednostką, poprzedni wynik ze zmianą,
zakres referencyjny z paskiem i status. Odchylenia mają bursztynowe tło i lewą
krawędź. Pasek jest obliczany wyłącznie dla liczbowych wartości i poprawnych
przedziałów ze źródła; tekst pozostaje tekstem. Nie kopiować przykładowych
opisów medycznych ani wyników z makiety do danych użytkownika.

Uzgodnione rozszerzenie tabeli: parametry są pogrupowane według zapisanych kategorii
(Morfologia, Profil nerkowy, Profil wątrobowy, Pozostałe). Nagłówki grup pokazują
liczbę parametrów i pozwalają zwinąć/rozwinąć sekcję; domyślnie są rozwinięte.
Układ pięciu kolumn i wyróżnienia wyników pozostają zachowane. Kliknięcie nazwy
parametru wybiera jego trend i przewija do wykresu, także z końca tabeli.
Przy wykresie jest lista parametrów bieżącego badania z wyszukiwaniem po nazwie,
jednostce i kategorii. Opcje zachowują grupowanie; wybór synchronizuje się
z kliknięciem w tabeli. Obsługa klawiaturą: strzałki, Enter, Escape i Tab.

Weryfikacja Split-Screen 2: prawa kolumna ma zwartą kartę metadanych i wspólną
kartę parametrów. Zgodnie z korektą użytkownika z 2026-10-19 każdy parametr
pokazuje podpisane pola Wynik, Jednostka i Zakres z dokumentu obok siebie,
jak w wyróżnionym wariancie. Na telefonie pola przechodzą do jednej kolumny.
Odchylenia zachowują bursztynowe tło; nazwa i kategoria mają osobne rozwijanie.
Uwagi pochodzą z dokumentu; nie kopiować demonstracyjnej interpretacji ani
procentowej pewności z makiety do rzeczywistych danych.

Lista badań (rozszerzenie zaakceptowane przez użytkownika bez nowej makiety):
zakładka Wyniki badań domyślnie pokazuje listę z wyszukiwaniem po nazwie,
laboratorium i dacie. Nazwa oraz przycisk z lupką „Otwórz badanie” prowadzą
do dotychczasowych szczegółów. Powrót zachowuje wyszukiwanie i przywraca fokus
do otwartego badania. Bezpośredni odnośnik i zapis nowego badania otwierają
szczegóły. Zachować widoczne etykiety, fokus oraz obsługę klawiaturą.

Nie zastępować kompozycji referencji dowolnym uproszczonym dashboardem.
Nie używać demonstracyjnych wyników, dat, masy, statusów zdrowia ani fotografii
jako danych konta. Nie usuwać całych obszarów wzorca z powodu braku backendu:
zachować strukturę i opisać stan niedostępności. Nie dodawać fikcyjnych wykresów.
Nie narzucać domyślnego zakazu trzech kolumn ani zmiany fontów ze skilla — tutaj
użytkownik zażądał zgodności z istniejącym projektem.
