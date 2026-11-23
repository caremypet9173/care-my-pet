-- Migracja: Zezwolenie na współdzielenie pliku źródłowego przez wiele zdarzeń pet_health_event (batch import wypisów)
-- Usunięcie ograniczenia UNIQUE dla kolumny source_path w tabeli pet_health_event
-- oraz dodanie zwykłego indeksu dla wydajnego wyszukiwania i czyszczenia powiązanych plików.

alter table public.pet_health_event drop constraint if exists pet_health_event_source_path_key;
create index if not exists pet_health_event_source_path_idx on public.pet_health_event(source_path);
