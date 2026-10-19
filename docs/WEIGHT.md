# Waga i rozwój

Zakładka kartoteki zawiera aktualną masę, różnicę względem poprzedniego pomiaru,
wykres ostatnich 12 pomiarów i tabelę maksymalnie 500 najnowszych wpisów.
Historia jest w tej samej zakładce. Brak pomiarów pokazuje stan pusty.

Dodawanie i edycja odbywają się w dialogu zgodnym z ekranem Stitch
`ef987ad210ed4c898f7e7238702b2510`; układ zakładki bazuje na
`f0f3733654d74fd083cdf0d5c6369bfc`. Oddzielny ekran historii
`7253951ec0d34c419e6f2278ac1d130d` nie jest używany.

Wymagane: dodatnia masa w kg (do 3 miejsc po przecinku) i poprawna data,
nie późniejsza niż dzisiaj w Europe/Warsaw. Notatka opcjonalna, do 200 znaków.
Pole masy przyjmuje kropkę lub przecinek i blokuje tekst. Zmiana masy nie
otrzymuje automatycznej oceny medycznej. Bieżący pomiar trafia też do podsumowania.

Zapis: Edge Function `pet-weight`, RPC `save_pet_weight`, tabela `pet_weight`.
RLS ogranicza dostęp do gospodarstwa pupila. Idempotentne tworzenie chroni
przed powieleniem po ponowieniu; edycja wymaga aktualnej rewizji (konflikt 409).
Usuwanie przez `delete_pet_weight` wymaga potwierdzenia z datą i wagą pomiaru
w dialogu aplikacji, spójnym z formularzem pomiaru. Domyślny fokus trafia na
„Anuluj”; Escape i zamknięcie niczego nie zmieniają. W trakcie usuwania przyciski
są zablokowane, a błąd zapisu pozostaje w dialogu. Usunięcie wymaga
aktualnej rewizji i dostępu do gospodarstwa; odświeża historię i bieżącą masę.
Nie wdrożono automatycznego odczytu masy z dokumentów.

Testy: `tests/e2e/weight-live.spec.ts` z jawnie ustawionym
`PETS_TEST_CREDENTIALS` sprawdzają desktop/mobile, zapis i odczyt z Supabase,
anulowanie, walidację UI/API, edycję, konflikt, retry, dostępność axe i szerokość
320 px. Identyfikatory syntetycznych pupili zapisują w ignorowanym dzienniku
`tmp/weight-test-fixtures.jsonl`; po testach wymagane jest usunięcie tych danych.
