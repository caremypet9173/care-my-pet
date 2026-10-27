# Wyniki badań i weryfikacja dokumentu — 2026-10-18

Backend wdrożony w Supabase `lrlnqmciarjvngvquchu`; frontend działa lokalnie.
Nie opublikowano zmian na Vercel.

## Wzorce i przepływ

Projekt Stitch `1963478756572071889`:

- „Forest — Kartoteka Luny — Wyniki badań”: `7cb450a3e2fb4067a1b191cedaf4aa0c`.
- „Forest — Kartoteka Luny — Weryfikacja odczytu badania (Split-Screen 2)”:
  `4036ab7f7cfa47c3b1643e5cb81db90c`, potwierdzony bezpośrednim linkiem użytkownika.
  API zwraca nazwę bez „2”; identyfikator jest rozstrzygający.

Kartoteka → zakładka Wyniki badań → Dodaj badanie → wybór PDF/JPG/PNG →
odczyt Gemini lub ręczne wpisanie → porównanie z oryginałem → sprawdzenie każdego
parametru i potwierdzenie danych → zapis → lista z oryginałem.
Trasa formularza: `/pl/app/zwierzeta/[id]/badania/nowe` (także `/en`).
Powrót do wyników: `/app/zwierzeta/[id]?tab=results`.

Odczytane wartości pozostają wyłącznie w pamięci formularza; nie zapisujemy
szkiców medycznych w DB ani localStorage. Plik trafia do Storage dopiero przy
zatwierdzeniu całego formularza. Zamknięcie strony traci niezapisane dane;
przeglądarka ostrzega przy opuszczeniu. Usunięcie lub zmiana pola cofa odpowiednie
potwierdzenie. Można zapisać dokument opisowy bez wierszy pomiarów.

## Dane i izolacja

Edycja z listy otwiera modal Stitch `28f38274a5db4a1b971bb3eb6149bc8b`.
Zmiany zapisuje akcja `correct` Edge Function oraz RPC `correct_measurement`.
Tabela `measurement_correction` przechowuje wartość, jednostkę, zakres, notatkę,
oznaczenie kluczowego parametru i rewizję. Oryginalny `pomiar_parametru` pozostaje
niezmienny, więc przywracanie działa po odświeżeniu. RLS ogranicza odczyt do
domowników; zapis przez RPC sprawdza właściciela/członkostwo, pupila i rewizję.
Konflikt edycji zwraca 409. Kluczowe parametry są widoczne w Podsumowaniu.
Nie wykonujemy automatycznego przeliczania jednostek ani diagnozy odchylenia.

Parametry mają przechowywany typ `value_type`: `decimal` lub `text`, wyznaczony
z pierwotnej wartości i zakresu referencyjnego, a nie z samej nazwy badania.
Edycja pokazuje typ i waliduje liczbę z kropką/przecinkiem oraz kwalifikatory
`<`, `>`, `<=`, `>=`, `≤`, `≥`. Dowolny tekst dla liczby blokują formularz,
Edge Function i trigger DB. Oryginalny zapis pozostaje tekstem źródłowym,
aby nie zgubić separatora i kwalifikatora; nie używamy binarnego float do
przechowywania wyników. Typu nie można zmienić przesłanym payloadem korekty.

- `wynik_badania`: pupil, gospodarstwo, nazwa, data, laboratorium, lekarz,
  opis, źródło i autor potwierdzenia.
- `pomiar_parametru`: oddzielny wiersz per parametr, wartość tekstowa zachowująca
  przecinki, znaki `<`/`>` i wyniki jakościowe, jednostka, zakres przepisany
  z dokumentu, grupa i kolejność. Bez JSONB jako magazynu parametrów.
- Słownik parametrów, mapowanie synonimów i konwersja jednostek są odłożone.
  Trend pokazuje ostatnie 12 porównywalnych pomiarów z wczytanej historii,
  niezależnie od daty otwartego badania (również późniejsze wyniki).
  Porównuje tylko identyczną nazwę i jednostkę. Niejednoznaczne powtórzenia
  w jednej dacie, kwalifikatory i wyniki nieliczbowe nie tworzą punktów trendu.
- RLS ogranicza wyniki i oryginały do gospodarstwa. Trigger kontroluje zgodność
  pupila z gospodarstwem i własność istniejącego pliku źródłowego.
- Prywatny bucket `medical-documents`, klucz `householdUUID/userUUID/reportUUID.ext`.
  Brak nadpisywania i usuwania dołączonego źródła. Link podglądu ważny 15 minut;
  „Pokaż oryginał” generuje nowy. Podpisany adres jest czasowym uprawnieniem,
  nie należy go publikować. [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).
- Edge Function `medical-reports` sprawdza JWT przez `getUser`, odrzuca anonimowe
  konta i korzysta z uprawnień użytkownika, bez service role.
- RPC `confirm_medical_report` atomowo zapisuje raport i pomiary; powtórzenie
  identycznego zatwierdzenia zwraca ten sam identyfikator. Zmieniona treść z tym
  samym ID zwraca konflikt zamiast utraty poprawek lub nadpisania historii.
- Storage i DB nie mają wspólnej transakcji. Błąd po uploadzie może zostawić
  osierocony plik. Ponowienie formularza wykorzystuje ten sam plik i identyfikator;
  zmiana dokumentu próbuje usunąć niepowiązany upload. Automatyczny cleanup
  i edycja/usuwanie zatwierdzonych badań pozostają do wdrożenia.

## Odczyt AI

Sekrety wyłącznie w Supabase: `GEMINI_API_KEY`, `GEMINI_MODEL`.
Klucz użytkownika przeniesiono z ignorowanego `.env` bez wypisywania wartości.
Model ustawiony na `gemini-3.5-flash-lite` (wcześniej `gemini-3.1-pro-preview`, zmieniony ze względu na optymalizację kosztów ekstrakcji dokumentów i odpisów wizyt).
[Gemini 3](https://ai.google.dev/gemini-api/docs/generate-content/gemini-3).

Wywołanie REST `generateContent`, JSON Schema, maks. 8192 tokeny wyjścia,
90 s timeout, plik do 6 MB, request do 9 MB, maks. 100 parametrów.
Sygnatura pliku i typ sprawdzane przez UI oraz Edge Function. Odczyt nie wykonuje
poleceń z dokumentu, nie diagnozuje i nie uzupełnia brakujących norm. Odpowiedź
modelu przechodzi walidację, po czym użytkownik sprawdza wszystkie pola.
Nie pokazujemy wymyślonych procentów pewności ani automatycznej interpretacji.
[Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

Limit 10 prób na konto na dobę UTC jest atomowy. Prywatna tabela
`private.medical_read_quota` przechowuje tylko licznik i dzień, bez danych badań.
Ma RLS, brak bezpośrednich uprawnień i celowo brak polityk. Jedyna funkcja
SECURITY DEFINER działa w prywatnym schemacie, sprawdza `auth.uid()` i wyłącznie
zwiększa licznik. Użytkownik nie może go wyzerować. Nieudane wywołanie dostawcy
też zużywa próbę. Limity globalnego budżetu ustawia właściciel projektu Google.

**Weryfikacja odczytu:** po uzupełnieniu środków Google błąd 402 ustąpił.
Następny błąd 400 odtworzono niezależnie od PDF: dostawca odrzucał `maxItems`
w zagnieżdżonym schemacie odpowiedzi. Usunięcie tego pola przy zachowaniu
walidacji limitu 100 wierszy w backendzie i DB rozwiązało problem.
Rzeczywisty test desktop PDF → Gemini → weryfikacja dwóch parametrów →
poprawka → zapis → odświeżenie → podgląd źródła przeszedł 2026-10-18.
Weryfikacja dotyczy syntetycznego dokumentu, nie jakości na badaniach użytkownika.
Usunięto kartotekę, raport i PDF utworzone przez ten test.

## Podgląd i testy

PDF.js 6.4.299 renderuje oryginał lokalnie w przeglądarce, także na mobile.
Worker jest kopiowany z przypiętej paczki przez `predev`/`prebuild`, bez CDN.
Podgląd ma strony, zoom i tekst strony dla czytników ekranu. Nie renderujemy
aktywnych skryptów ani formularzy PDF. Tekst dostępności nie zastępuje kontroli
obrazu oryginału. [PDF.js](https://mozilla.github.io/pdf.js/examples/).

- `tests/medical-validation.test.mjs`: daty, limity, sygnatury, kwalifikatory,
  brak automatycznego porównywania niejednoznacznych wartości i zakresów.
- `supabase/tests/medical_reports_rls.sql`: właściciel, członek i obce konto,
  źródła i pomiary, brak nadpisywania, idempotencja i quota; transakcja z rollback.
- `tests/e2e/medical-live.spec.ts`: rzeczywisty zapis, odświeżenie, prywatny PDF,
  ponowienie, konflikt zmienionego payloadu, potwierdzenia, Axe i szerokość 320 px.
  Wymaga `PETS_TEST_CREDENTIALS=tmp/auth-test-credentials.json`. Opcja
  `MEDICAL_TEST_AI=1` uruchamia rzeczywisty odczyt (koszt API);
  `MEDICAL_TEST_AI=mock` sprawdza formularz na kontrolowanej odpowiedzi odczytu,
  ale nadal zapisuje dokument i wyniki w rzeczywistym Supabase.
  Wyłączone trace/video. Syntetyczne fixture mają prefiks `TEST MEDICAL`,
  identyfikatory w ignorowanym `tmp/medical-test-fixtures.jsonl` do cleanupu.
  Ostatnie przebiegi desktop (kontrolowana odpowiedź odczytu) i mobile (ręcznie)
  przeszły, włącznie z renderowaniem PDF i konfliktem zmienionego potwierdzenia.
  Usunięto wszystkie 11 kartotek testowych i 5 zapisanych źródeł z tej sesji.
- `npm run build`, `npm run lint`, Deno check; audyt zależności produkcyjnych:
  brak zgłoszonych podatności.

Audyt Supabase: informacja o celowo zamkniętej tabeli quota
([RLS bez polityk](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy))
oraz wcześniejsza uwaga o niewłączonej
[ochronie haseł z wycieków](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Prawa kolumna weryfikacji odwzorowuje hierarchię Split-Screen 2: zwarta karta
metadanych, wspólna karta parametrów, rozwinięte bursztynowe odchylenia i krótkie
wiersze pozostałych wyników z możliwością edycji. Zachowano potwierdzenie każdego
parametru; zmiana wartości unieważnia potwierdzenie. Dolna karta zawiera uwagi
z dokumentu, bez generowania interpretacji lub fikcyjnej pewności odczytu.
Po tej korekcie przeszły testy desktop i mobile, Axe, typecheck oraz lint.

Lista pokazuje maks. 100 najnowszych badań. Interpretacja Claude, automatyczne
powiązanie z wizytą, szkice na serwerze, wieloplikowy import i sortowanie
synonimów nie są częścią tego wdrożenia. Zakładka Dokumenty (`?tab=documents`,
`?tab=documents&document=UUID`) prezentuje listę źródeł zapisanych badań
z wyszukiwaniem po nazwie badania, pliku, laboratorium i dacie, podglądem PDF.js
lub obrazu w dialogu, metadanymi, nawigacją między dokumentami oraz przejściem
do szczegółów badania.
# Identyczne pliki

Przed odczytem Gemini formularz liczy SHA-256 zawartości i sprawdza dokumenty
w kartotece wybranego pupila. Zmiana nazwy pliku nie omija kontroli. Komunikat
prowadzi do konkretnego badania przez `?tab=results&report=UUID`, także gdy
badanie znajduje się poza listą 100 najnowszych wpisów.

Edge Function ponownie liczy skrót przed Gemini i przy zatwierdzaniu dokumentu.
RPC blokuje równoczesne zapisy tej samej pary pupil–skrót. Ponowienie zapisu
z tym samym ID nadal jest idempotentne. Starsze dokumenty bez skrótu są odczytywane
z prywatnego Storage w uprawnieniach użytkownika; tylko wyliczony skrót jest
uzupełniany przez klienta serwisowego. Nie zmieniamy treści ani istniejących badań.
Wcześniej zapisane duplikaty pozostają zachowane. Brak możliwości sprawdzenia
pliku pokazuje błąd zamiast uznawać go za nowy.

Kontrola wykrywa identyczne bajty, nie podobne skany ani ponownie wygenerowane PDF.
Test `medical-duplicate.spec.ts`: zmieniona nazwa, brak wywołania AI, konflikt
równoczesnych zapisów, retry i otwieranie istniejącego badania na desktop/mobile.

# Historia zdrowia, koszty AI i baza wektorowa RAG — 2026-10-19

## Zakładka Historia (`?tab=history`) i ekstrakcja odpisów wizyt
- Tabela `public.pet_health_event` przechowuje wpisy z kategorii `visit` (wizyta), `vaccination` (szczepienie) oraz `prevention` (leki / profilaktyka) wraz z opcjonalnym załącznikiem źródłowym (`source_path`, `source_name`, `source_mime`, `source_sha256` w buckecie `medical-documents`).
- Edge Function `pet-history` obsługuje operacje `extract`, `create`, `update`, `delete` z walidacją RLS po `gospodarstwo_id`.
- W modalu dodawania wpisu użytkownik może załączyć PDF/JPG/PNG i kliknąć „Odczytaj z pliku (AI)” — model `gemini-3.5-flash-lite` wypełnia pola formularza, a po zapisie załącznik jest również widoczny w zakładce **Dokumenty** (`?tab=documents`).

## Statystyki i koszty zapytań Gemini API (`private.ai_usage_log`)
- Tabela `private.ai_usage_log` (migracje `20261019170000_ai_usage_log.sql`, `20261019190000_fix_ai_usage_log_visibility.sql`, `20261019190500_fix_log_ai_usage_rls.sql`) rejestruje każde wywołanie AI (`medical_report`, `health_event`, `embedding`, `ai_assistant`): liczbę tokenów (`prompt_tokens`, `output_tokens`, `thoughts_tokens`, `total_tokens`), czas odpowiedzi (`duration_ms`), status oraz wyliczony koszt w USD (`estimated_cost_usd` przez `private.calculate_gemini_cost_usd`).
- Widok `private.ai_cost_summary` agreguje miesięczne zużycie tokenów i koszty wg funkcji i modelu (dostępny bezpośrednio z Supabase SQL Editor).

## Baza wektorowa RAG (`pgvector`) pod Asystenta AI
- Włączono rozszerzenie `vector` (`pgvector`) i utworzono tabelę `public.pet_knowledge_chunk` z indeksem HNSW (`vector_cosine_ops`, wymiar `768`, model `gemini-embedding-001` / `gemini-embedding-2`).
- Przy każdym zatwierdzeniu badania (`medical-reports` → `confirm`) oraz utworzeniu/edycji wpisu historii (`pet-history` → `create`/`update`) moduł `supabase/functions/_shared/rag.ts` buduje ustrukturyzowany tekst kliniczny, generuje znormalizowany wektor 768D i zapisuje go przez `public.upsert_pet_knowledge_chunk`.
- Funkcja `public.match_pet_knowledge(p_pet_id, p_query_embedding, p_match_count)` realizuje wyszukiwanie semantyczne (cosine similarity) w obrębie kartoteki pojedynczego pupila z zachowaniem RLS.

# Badania obrazowe i opisowe (USG, TK, RTG, ECHO) — 2026-10-20

Wdrożono **Opcję A — obsługa w zakładce „Wyniki badań” (`/badania/nowe` + `MedicalResults`) z automatyczną widocznością w „Historii” i „Dokumentach”**:

1. **Prompt, walidacja i baza danych (`supabase/functions/medical-reports/index.ts`, `validation.mjs`, migracja `20261020150000_increase_medical_report_notes_limit.sql`)**:
   - Zwiększono limit długości pola `wynik_badania.notes` z `4000` do `12000` znaków (w bazie danych, walidacji backendu oraz formularzu frontendu), aby pomieścić wielostronicowe opisy badań TK/USG.
   - Rozszerzono instrukcję systemową Gemini: dla badań obrazowych/opisowych (TK/CT, USG, RTG, ECHO, MRI, endoskopia, histopatologia, cytologia) bez tabeli parametrów laboratoryjnych model zwraca `rows: []`, konwertuje jednoznaczne daty (w tym `DD/MM/YYYY` i `DD.MM.YYYY`) do `YYYY-MM-DD`, wyodrębnia imię zwierzęcia z pola pacjenta oraz kopiuje pełny ustrukturyzowany opis (`Stwierdzono:`, opis narządów, `Wnioski:`) do pola `notes`.
   - W module indeksowania RAG (`supabase/functions/_shared/rag.ts`) badania bez wierszy parametrów są oznaczane nagłówkiem `Badanie obrazowe / opisowe`.
2. **Formularz weryfikacji (`src/features/medical/review-form.tsx`)**:
   - Gdy `draft.rows.length === 0`, sekcja parametrów wyświetla informację o badaniu opisowym/obrazowym (z zachowaniem przycisku „Dodaj parametr”), a sekcja **Opis badania obrazowego / wnioski z dokumentu** (`notes`) jest automatycznie rozwinięta i powiększona (`rows={14}`).
3. **Widok listy i szczegółów badania (`src/features/medical/report-list.tsx` i `src/features/medical/results.tsx`)**:
   - Na liście badań oraz w selektorze badań zamiast `0 parametrów` wyświetlane jest oznaczenie `Badanie opisowe / obrazowe` (`opisowe`).
   - W szczegółach badania dla `report.rows.length === 0` ukryto pustą kartę wykresu trendu oraz filtry kategorii, eksponując kartę **Opis badania obrazowego / specjalistycznego** z pełną treścią `report.notes` oraz podglądem źródłowego pliku PDF/obrazu.
4. **Oś czasu w zakładce Historia (`src/features/history/history-panel.tsx`)**:
   - Dla badań opisowych (`rep.rows.length === 0`) karta na osi czasu prezentuje odznakę `Badanie obrazowe / opisowe`, status `Opis badania`, skrót opisu z `rep.notes` oraz linki do pełnego opisu i dokumentu źródłowego.
