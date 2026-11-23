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

Trasy pod `/pl` i `/en`: `/app`, `/app/pets/new`,
`/app/pets/[id]`, `/app/pets/[id]/edit`.
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
- **Szybki przełącznik pupili (`PetSwitcher`):** na trasie `/app/pets/[id]`
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

## Aktualizacja 2026-11-17 — Odwracalne zamknięcie (archiwizacja) i przywracanie kartoteki

- **Schemat i ochrona DB (`20261117210000_pet_archiving.sql`):**
  - Tabela `public.zwierze` rozszerzona o kolumny `archived_at`, `archived_by`,
    `archive_reason` (`'deceased' | 'rehomed' | 'other'`), `closed_on` (opcjonalna data
    pożegnania wyłącznie dla `'deceased'`, walidowana w przedziale od `1900-01-01`
    oraz `>= data_urodzenia` do bieżącej daty) i `archive_note` (maks. 1000 znaków)
    oraz częściowy indeks `zwierze_active_idx` (`where archived_at is null`).
  - Funkcje RPC `public.archive_pet` i `public.restore_pet` (`SECURITY INVOKER`)
    dostępne wyłącznie dla właściciela gospodarstwa (`gospodarstwo.owner_id = auth.uid()`).
    `archive_pet` wycisza aktywne harmonogramy (`medication_schedules.is_active = false`),
    anuluje zaplanowane wizyty (`pet_schedule_item.status = 'cancelled'`) i unieważnia
    aktywne linki udostępniania (`pet_share_link.revoked_at = now()`).
  - Triggery `guard_archived_pet_update` (na `zwierze`) i `a_reject_archived_pet_mutation`
    (na `wynik_badania`, `pomiar_parametru`, `measurement_correction`, `pet_weight`,
    `pet_vital_measurement`, `pet_fluid_therapy`, `pet_health_event`, `medication_schedules`,
    `medication_logs`, `pet_schedule_item`, `pet_knowledge_chunk`) blokują mutacje z kodem `PT423`.
- **Edge Functions (`lrlnqmciarjvngvquchu`):**
  - `pets`: akcje `archive` i `restore` oraz walidacja `validateArchivePet`
    w `supabase/functions/pets/validation.mjs`.
  - `schedule-notifications`: filtrowanie aktywnych pupili (`.is("archived_at", null)`)
    w `test_digest` i cronie (e-mail i Web Push).
  - `pet-assistant`: przekazuje status archiwalny oraz ewentualną datę i notatkę
    do instrukcji systemowej, odpowiadając wyłącznie retrospektywnie.
  - `medical-reports`, `pet-history`, `pet-medications`, `pet-schedule`, `pet-weight`:
    blokują mutacje zarchiwizowanych kartotek odpowiedzią HTTP `423` (`pet_archived`).
- **Interfejs (`src/features/pets/`, `src/app/[locale]/(private)/app/`):**
  - Na `/app/pets/[id]/edit` właściciel ma sekcję „Zamknięcie kartoteki”
    (`PetArchiveSection` z wyborem powodu, opcjonalną datą pożegnania przy `deceased`
    i notatką); po zamknięciu wszystkie podstrony edycji/dodawania pokazują blokadę
    `PetArchivedBlockedCard`.
  - `HouseholdDashboard` przenosi zarchiwizowane profile do zwijanej sekcji
    „Zamknięte kartoteki” i filtruje po aktywnych pupilach statystyki oraz kalendarz.
  - `PetHeroCover` wyświetla stonowany tryb pamięci (`W pamięci` + lata/data) lub
    `Kartoteka zamknięta` (także w `SharedVetRecordView` przy ręcznym udostępnieniu),
    `PetArchivedBanner` daje właścicielowi akcję „Przywróć kartotekę” (`PetRestoreButton`),
    a wszystkie panele na `/app/pets/[id]` otrzymują `readOnly={isArchived}`.

## Aktualizacja 2026-11-18 — Archiwum danych do pobrania (7 dni, kod na e-mail, raport PDF + pliki)

- **Baza danych (`20261118120000_pet_archive_links.sql`):**
  - Tabela `public.pet_archive_link` (z jawnymi `GRANT` przed RLS) przechowująca
    7-dniowe linki do pobrania archiwum pupila: `token`, `recipient_email`,
    `access_code_hash` + `access_code_salt` (PBKDF2 SHA-256), `expires_at`, `revoked_at`,
    `failed_attempts`, `locked_until` oraz liczniki (`unlocked_count`, `pdf_download_count`,
    `file_download_count`). Dostęp przez RLS i mutacje w UI wyłącznie dla właściciela
    gospodarstwa.
- **Edge Function `pet-archive` (`supabase/functions/pet-archive/`):**
  - Właściciel (`list`, `create`, `revoke`): tworzy 7-dniowy link, generuje 8-znakowy kod
    dostępu (`XXXX-XXXX`), zapisuje solony hash i wysyła link wraz z kodem przez SMTP
    (`nodemailer`) na wskazany adres e-mail.
  - Odbiorca (`get_meta`, `unlock`, `get_document_url`, `track_pdf_download`):
    weryfikuje kod z blokadą na 15 min po każdych 5 błędnych próbach, zwraca podpisany
    30-minutowy token sesji HMAC oraz dane kliniczne i listę załączników (bez czatów
    Asystenta AI, logów domowników i prywatnej notatki zamykającej); pliki z
    `medical-documents` pobierane są bezpośrednio na żądanie przez `signedUrl`.
- **Interfejs i raport PDF (`src/features/archive/`, `/archive/[token]`):**
  - Przycisk `ArchiveLinkButton` na widoku kartoteki (zarówno aktywnej, jak i zamkniętej)
    obok `ShareRecordButton`, widoczny wyłącznie dla właściciela (`isOwner`).
  - Publiczna strona `src/app/[locale]/(public)/archive/[token]/page.tsx` +
    `ArchivePortalView`: bramka z kodem dostępu, statystyki kartoteki, generator
    wielostronicowego raportu A4 PDF po stronie przeglądarki (`buildPetArchivePdf` w `pdf-lib`
    z osadzoną czcionką `Inter`) oraz pobieranie oryginalnych załączników badań.

## Aktualizacja 2026-11-18 — Klucz odzyskania dostępu, blokada read-only i współadministratorzy

- **Baza danych (`20261118150000_recovery_key_and_household_admin.sql`, `20261118153000_recovery_private_rpc.sql`):**
  - Usunięcie `UNIQUE(owner_id)` z `public.gospodarstwo` (jeden użytkownik może być właścicielem
    wielu domostw jednocześnie) oraz aktywacja roli współadministratora `czlonek_gospodarstwa.rola = 'admin'`
    w `is_household_admin()`, RLS, `create_pet(..., p_household_id)`, `archive_pet` i `restore_pet`.
  - Kolumny `recovery_email`, `recovery_key_hint`, `recovery_key_set_at`, `recovery_key_set_by` na
    `public.gospodarstwo` chronione triggerem `guard_household_recovery_fields`, prywatne tabele
    `private.household_recovery_secret`, `private.household_recovery_claim` i `private.recovery_rate_limit`
    obsługiwane atomowymi funkcjami RPC dla `service_role`.
  - Obowiązkowa blokada **tylko do odczytu (`PT428`)**: triggery `b_enforce_household_recovery_key`
    na `zwierze` oraz tabelach klinicznych i RPC blokują zapis/edycję/archiwizację, dopóki
    domostwo nie ma aktywnego klucza odzyskania (`recovery_key_set_at is not null`). Po zużyciu
    klucza w procesie odzyskania klucz wygasa, a nowe domostwo znów wchodzi w tryb `read-only`
    aż do wygenerowania kolejnego klucza.
  - Tabela `public.household_admin_request` (z jawnymi `GRANT` przed RLS) obsługująca 14-dniowy
    wniosek opiekuna (`member`) o rolę współadministratora z oknem weta dla właściciela i automatycznym
    zatwierdzeniem po upływie terminu (`auto_approve_expired_admin_requests`).
- **Edge Functions (`household`, `household-recovery`, `schedule-notifications`, funkcje kliniczne):**
  - `household`: akcje `generate_recovery_key`, `update_recovery_email`, `set_member_role`,
    `request_admin_takeover`, `respond_admin_request` oraz wsparcie `canManage` (`owner` lub `admin`).
  - `household-recovery`: publiczne akcje `initiate` (weryfikacja PBKDF2 SHA-256 + limit 5 prób / 15 min
    + 24h link na `target_email` + alert bezpieczeństwa na `owner_email` i `recovery_email`),
    `get_claim`, `register_and_confirm` oraz `confirm_claim` (atomowe przekazanie własności,
    odłączenie poprzedniego właściciela i skonsumowanie klucza).
  - `pets`, `pet-archive`, `pet-weight`, `medical-reports`, `pet-history`, `pet-medications`, `pet-schedule`:
    obsługa kodu `PT428` (`HTTP 428 recovery_key_required`) oraz dostęp współadministratorów w `pet-archive`.
  - `schedule-notifications`: automatyczne zatwierdzanie przeterminowanych wniosków `household_admin_request`
    w cronie z powiadomieniem e-mail.
- **Interfejs (`src/features/household/`, `/recover`, `/recover/confirm/[token]`):**
  - `HouseholdRecoveryBanner` + `RecoveryKeyDialog` + generator karty A4 PDF (`buildRecoveryKeyPdf`
    w `recovery-key-pdf.ts`) na pulpicie `/app`, kartotekach i formularzach.
  - Publiczny portal odzyskania `/recover` oraz potwierdzenia przejęcia `/recover/confirm/[token]`
    z bezpośrednią rejestracją lub logowaniem docelowego adresu e-mail.
  - Sekcja bezpieczeństwa, zarządzania e-mailem pomocniczym, awansowania na `Współadministratora`
    oraz obsługi 14-dniowych wniosków ciągłości w `/app/household`.
