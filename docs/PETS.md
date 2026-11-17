# Profile zwierząt — 2026-10-18

W projekcie Supabase `lrlnqmciarjvngvquchu` działają migracje gospodarstw,
członkostw i zwierząt oraz Edge Function `pets`. Frontend jest dostępny lokalnie;
ten etap nie obejmuje publikacji na Vercel.

## Widoki i projekt

Źródło: [Stitch — Care My Pet](https://stitch.withgoogle.com/projects/1963478756572071889).
Lista: „Forest — Pulpit Domowy (Lista pupili)” (`55fb2fa4b794438984a9290ea6915e1a`).
Profil: „Forest — Moja Luna — Profil i podsumowanie” (`72bf93de4d4043ba9dec8591de4291c0`).
Paleta i typografia: Signature (`b19e91a73daf435ba4c3d28e4130e215`).
Dodawanie: „Poznajmy Twojego pupila” — Desktop, Mobile i Dopasowanie zdjęcia.
Identyfikatory sześciu ekranów i ich role: `stitch/DESIGN.md`.

Trasy pod `/pl` i `/en`: `/app`, `/app/zwierzeta/nowe`,
`/app/zwierzeta/[id]`, `/app/zwierzeta/[id]/edytuj`.
Po korekcie zgodności ze Stitch panel zachowuje pasek podsumowania,
zwarte karty, sekcję terminarza, okładkę profilu, zakładki i kolumnę boczną.
Specyfikacja odwzorowania: `stitch/DESIGN.md`. Karty, puste stany i formularz
korzystają z tokenów Signature. Niepodłączone moduły mają opis
„W przygotowaniu”; przycisk przesyłania dokumentów jest nieaktywny i opisany.
Brak fikcyjnych wyników, dat, wykresów, statusów zdrowia czy zdjęć pupila.

Podsumowanie: „Ostatnie badania” pokazuje pięć najnowszych raportów z datą,
laboratorium i odnośnikiem do szczegółów oraz przejście do pełnej listy.
Na życzenie użytkownika duży boczny box wagi zastąpiono pozycją w podstawowych
informacjach: najnowsza waga, data pomiaru i link do zakładki „Waga i rozwój”.

## Dane i bezpieczeństwo

- `gospodarstwo`: jedno własne gospodarstwo na użytkownika. Powstaje atomowo
  przy dodaniu pierwszego pupila w RPC `create_pet`, działającym jako caller.
- `czlonek_gospodarstwa`: fundament współdzielenia. Członek widzi swoje
  członkostwo oraz zwierzęta gospodarstwa; może edytować ich profile.
  Samodzielne dopisywanie członkostwa jest zabronione. Zaproszenia i zarządzanie
  rodziną pozostają do wdrożenia. Obecny formularz tworzy pupila we własnym domu.
- `zwierze`: kot/pies, imię, rasa, data urodzenia, płeć, kastracja,
  identyfikacja, numer oraz notatki. Nieznane dane mogą pozostać puste.
  Data może być oznaczona jako przybliżona; oznaczenie wymaga podania daty.
  Numer mikroczipa: 15 cyfr; tatuaż: wymagany numer do 50 znaków.
- RLS obowiązuje dla wszystkich tabel. Brak dostępu anonimowego oraz usuwania
  z poziomu aplikacji. Tożsamość i przypisanie zwierzęcia są niezmienne.
  Trigger ustawia autora i czas edycji. Nie używamy klucza service role w UI ani funkcji.
- `pets` sprawdza JWT przez Auth `getUser`, odrzuca anonimowe konta,
  ogranicza body do 24000 bajtów i waliduje dozwolone pola. Wyłączona bramka
  `verify_jwt` nie oznacza publicznego zapisu: uwierzytelnienie wykonuje handler,
  a operacje DB działają z JWT użytkownika i RLS.
- Edycja warunkowana przez `updated_at`; konflikt lub brak dostępu zwraca 409.
  Formularz zachowuje wpisane dane i prosi o ponowne otwarcie profilu.
- Kontrola DB powtarza kluczowe ograniczenia dla bezpośrednich wywołań API.
  Odczyty SSR używają sesji użytkownika. Trasy są dynamiczne, bez współdzielonego cache.

## Zdjęcie pupila

Opcjonalny awatar można dodać, zmienić i usunąć w formularzu. Kadrowanie
działa lokalnie: przesunięcie, powiększenie, obrót, reset oraz anulowanie.
Obsługiwane wejście to JPG, PNG lub WebP do 10 MB i 40 megapikseli.
Wysyłany jest wyłącznie wynik canvas: JPEG 512 × 512, bez metadanych oryginału.
Wybór i dopasowanie zdjęcia nie zapisują niczego na serwerze; upload następuje
po zatwierdzeniu całego formularza.

Prywatny bucket `pet-avatars` przyjmuje JPEG do 1 MB. Nowy obiekt ma ścieżkę
`userUUID/fileUUID.jpg`; RLS zabrania nadpisywania i zapisu w cudzym katalogu.
Trigger kontroluje właściciela i istnienie obiektu przy przypisaniu do profilu.
Członkowie gospodarstwa odczytują zdjęcia swoich pupili. SSR generuje podpisane
adresy ważne godzinę, używane na liście i w profilu. Adres jest czasowym
uprawnieniem dostępu — nie należy go publikować. Podstawa:
[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).

Po zmianie/usunięciu awatara aplikacja próbuje usunąć poprzedni plik;
po błędzie zapisu próbuje usunąć nowy upload. Storage i zapis profilu nie są
wspólną transakcją: przerwane połączenie może pozostawić nieużywany plik.
Automatyczne porządkowanie takich plików pozostaje do wdrożenia.

## Weryfikacja

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `node --test tests/pet-crop.test.mjs tests/pets-validation.test.mjs`: 7 testów
  geometrii kadru, normalizacji, dat, identyfikacji, awatarów i limitów.
- `npx deno check supabase/functions/pets/index.ts`.
- `supabase/tests/pets_rls.sql` wykonany w zdalnej bazie: właściciel,
  członek i obce konto, izolacja odczytu/edycji, autor zmian, brak samodzielnych
  zaproszeń, blokada anonimowego dostępu. Całość w transakcji z rollback.
- `supabase/tests/pet_avatars_rls.sql`: upload tylko we własnym katalogu,
  zakaz nadpisywania, odczyt członka, izolacja obcego konta i walidacja
  przypisania zdjęcia. Wykonany z rollback.
- `tests/e2e/pets-form.spec.ts`: walidacja, poprawianie błędów, odrzucenie SVG,
  anulowanie kadrowania, lokalny podgląd, dostępność i szerokość 320 px.
  Nie zapisuje profili ani plików w Storage.
- `tests/e2e/pets-live.spec.ts`: 2 testy (desktop/mobile) z prawdziwym kontem
  i bazą: utworzenie ze zdjęciem, kadrowanie, data przybliżona, edycja,
  odświeżenie, konflikt, lista EN, usunięcie zdjęcia, Axe i szerokość.
  Uruchamiane tylko z `PETS_TEST_CREDENTIALS` wskazującym ignorowany plik JSON
  `{email,password}`. Nie zapisują śladów sesji. Tworzą oznaczone profile;
  administrator musi usunąć wyłącznie identyfikatory zapisane do
  `tmp/pets-test-desktop.json` i `tmp/pets-test-mobile.json` po każdym przebiegu.
  Profile z bieżącego przebiegu oraz puste gospodarstwo testowe usunięto.
- Sprawdzono HTTP: brak/zły JWT → 401, niepoprawne dane → 400, duży body → 413.
- Regresja Auth i lokalizacji: `npm run test:e2e -- tests/e2e/auth.spec.ts tests/e2e/localization.spec.ts`.

Audyt Supabase: brak uwag do RLS nowych tabel. Odebrano API prawo wykonywania
wewnętrznej funkcji event trigger `rls_auto_enable`. Pozostaje wcześniejsza uwaga
[ochrona przed hasłami z wycieków](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
która nie jest włączona. Audyt wydajności wskazuje dwa
[jeszcze nieużyte indeksy](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
na kluczach obcych autorów zmian; pozostawione celowo dla przyszłych operacji.

## Kolejny etap

Wprowadzić rzeczywiste profile czterech kotów. Wyniki badań i prywatne źródła
wdrożono w kolejnym etapie opisanym w `MEDICAL_REPORTS.md`; rzeczywisty odczyt
Gemini sprawdzono na syntetycznym PDF. Pozostaje ocena prawdziwych badań. Usuwanie profili,
zaproszenia, wizyty i pomiary masy pozostają do wdrożenia.

## Aktualizacja 2026-11-17 — Hero, tagi opiekuńcze i szybki przełącznik kartotek

- **Kolumna `tagi` (`20261117101500_pet_tags.sql`):** tabela `public.zwierze` rozszerzona
  o `tagi text[] not null default '{}'` (maks. `8` tagów po maks. `40` znaków,
  deduplikacja case-insensitive w `validation.mjs` i obsługa w `create_pet`).
  W formularzu `PetForm` komponent `PetTagsInput` łączy dowolny wpis z klikalnym
  słownikiem podpowiedzi (`src/features/pets/tag-suggestions.ts`, dopasowanym do płci).
  Tagi wyświetlają się w hero (`PetHeroCover`), na kartach pulpitu (`/app`, maks. 3 + `+N`),
  w karcie leczenia (`TreatmentSummaryModal`) oraz trafiają do kontekstu Asystenta AI.
- **Kompaktowe hero i modal „O mnie” (`PetHeroCover`, `GuardianNoteCard`):**
  pole `notatki` ma w formularzu etykietę „Parę słów o mnie”. Zamiast szerokiego boksu
  tekstowego w hero wyświetla się przycisk „O mnie” otwierający `<dialog>` z pełnym
  opisem; przy pustym polu przycisk nie jest renderowany. To samo hero współdzieli
  widok udostępniony weterynarzowi (`SharedVetRecordView`, bez akcji edycji).
- **Szybki przełącznik pupili (`PetSwitcher`):** na trasie `/app/zwierzeta/[id]`
  przy `2–5` pupilach na desktopie (`> 960 px`) renderuje się pasek pigułek obok
  `← Wszystkie zwierzaki`, a powyżej `5` pupili oraz na węższych ekranach (`≤ 960 px`)
  rozwijany przycisk dropdown; przełączenie zachowuje aktywną zakładkę (`?tab=...`).
- **Service Worker (`public/sw.js`):** wersja cache `caremypet-v2`; na `localhost` /
  `127.0.0.1` wyłączono precache i przechwytywanie `fetch`, aby uniknąć serwowania
  przestarzałych chunków CSS/JS w trakcie lokalnego developmentu.
- **Weryfikacja:** `npm run typecheck`, `npm run lint` oraz `node --test tests/*.test.mjs`
  (`53/53`, w tym testy walidacji tagów w `tests/pets-validation.test.mjs`) przeszły
  po zmianach; `supabase db push` i `deploy` funkcji `pets` / `pet-assistant` wykonane
  na projekcie `lrlnqmciarjvngvquchu`. Testy E2E Playwright (`tests/e2e/pets-live.spec.ts`)
  zaktualizowano pod nowe etykiety i wymagają uruchomienia z poświadczeniami testowymi.
