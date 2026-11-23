# HOSTING — wybór dla cichego pilotażu

**Data weryfikacji źródeł:** 2026-09-28
**Status:** wybrano Vercel Hobby + Supabase Cloud Free dla pilotażu; uruchomienie osobno
**Powiązane:** TECH.md, PRD.md, ROADMAP.md, MONETIZATION.md

## Kontekst

M1 sprawdzone w odrębnych PoC. Pierwsze wdrożenie służy Wojtkowi (cztery koty,
dużo prawdziwych badań), następnie przyjaciołom. Mały ruch, ale wartościowe dane.
Ważne są szybkie iteracje UI, niezawodny zapis i możliwość odzyskania dokumentów.
Wojtek potwierdził, że własny serwer jest dopiero w planach. Ma osobę, która
mogłaby nim administrować, ale pilotaż nie będzie czekał na budowę infrastruktury.

## Dwie osobne decyzje

Vercel hostuje Next.js. Supabase zapewnia bazę, Auth, Storage i Edge Functions.
Wybór Vercel nie wymusza trzymania bazy i plików u tego samego dostawcy.
Możliwa jest aplikacja na Vercel z własnym Supabase; odwrotny układ także.
Hybryda wymaga poprawnej konfiguracji HTTPS, Auth/redirectów, CORS i połączeń.

| Wariant | Co zyskujemy | Co utrzymujemy | Ocena dla pilotażu |
|---|---|---|---|
| Vercel + Supabase managed | Wygodne wdrożenia i najmniej utrzymania serwerów | Kod, uprawnienia, koszty, kopie plików i sprawdzenie odtwarzania | Punkt wyjścia, gdy infrastruktura nie jest gotowa |
| Vercel + własny Supabase | Wygoda pracy nad UI i kontrola nad bazą/plikami | Cały backend, serwer, aktualizacje, monitoring i backupy | Sensowny, gdy własny backend jest już dobrze obsługiwany |
| Własny Next.js + Supabase | Kontrola nad całością, możliwy niski koszt przy istniejącym serwerze | Aplikacja, backend i komplet operacji | Dobry, gdy administrator dostarcza gotowe środowisko i prosty deploy |
| Własny Next.js + Supabase managed | Zarządzana baza przy istniejącym hostingu aplikacji | Serwer Next.js i wdrożenia | Opcja, jeśli jest już sprawdzony hosting Next.js |

## Koszty orientacyjne

**Start pilotażu: Vercel Hobby + Supabase Cloud Free — 0 USD/mies. za te plany
w ich limitach.** AI, domena, ewentualna poczta i kopie danych rozliczane osobno.
Poniższe płatne warianty to porównanie na przyszłość, nie budżet wymagany na start.

Kwoty USD/miesiąc, bez podatków, AI, domeny, poczty, kopii plików i dodatkowego
zużycia. To baza planów, nie gwarancja końcowego rachunku.

- **Vercel Pro: 20 USD/mies.** za platformę z jednym miejscem wdrażającym i
  20 USD kredytu na zużycie; dodatkowe miejsce wdrażające 20 USD/mies.
  Przyjaciele korzystający z aplikacji nie potrzebują miejsc w zespole Vercel.
  [Źródło: Vercel Pro](https://vercel.com/docs/plans/pro-plan).
- **Supabase Pro: od 25 USD/mies.**, pierwszy projekt w cenie; dodatkowe projekty
  od 10 USD/mies. **Free:** 500 MB bazy, 1 GB plików, brak automatycznych backupów
  i pauzowanie po tygodniu nieaktywności. Przy dużym archiwum badań trzeba zmierzyć
  objętość plików. [Źródło: cennik Supabase](https://supabase.com/pricing).
- **Managed razem: od około 45 USD/mies.** przy jednym miejscu Vercel Pro i jednym
  bazowym projekcie Supabase Pro. Dodatkowe środowiska mogą zwiększać koszt.
- **Hybryda:** 20 USD Vercel Pro + serwer, kopie i administracja backendu.
- **Pełny self-host:** serwer + zewnętrzne kopie + administracja. Bez specyfikacji
  istniejącego środowiska nie podajemy pozornie dokładnej wyceny.

Vercel Hobby jest ograniczony do osobistego, niekomercyjnego użycia. Wybieramy go
na początek z tym warunkiem; samo określenie „pilotaż” ani brak płatności nie
rozstrzygają kwalifikacji. Przed wykorzystaniem komercyjnym przechodzimy na Pro.
[Źródło: Hobby](https://vercel.com/docs/plans/hobby).

## Co daje Vercel, a co zostaje po naszej stronie

Wdrożenia z Git i osobne adresy preview usprawniają ocenę zmian UI.
Preview należy łączyć ze środowiskiem testowym, bez prawdziwych badań i kluczy
produkcyjnych. [Środowiska Vercel](https://vercel.com/docs/deployments/environments).

Vercel nie przejmuje administracji własnym Supabase. Hybryda usuwa utrzymanie
serwera Next.js, ale pozostawia najważniejszy obowiązek: utrzymanie danych.
Wybór hostingu nie zmienia wymogu RLS, zatwierdzania odczytów AI ani kontroli kosztów.

## Własny hosting — alternatywa na później

Przy ewentualnej migracji punktem wyjścia może być jeden serwer i Docker Compose. Kubernetes ma sens,
jeśli administrator ma już utrzymywany klaster i gotowe procedury. Nie jest
wymaganiem produktu. Oficjalna dokumentacja Supabase wskazuje Docker jako ścieżkę
self-hostingu, a Helm/K8s jako opcję społecznościową.
[Supabase self-hosting](https://supabase.com/docs/guides/self-hosting).

Dla wszystkich komponentów Supabase dokumentacja podaje minimum 4 GB RAM,
2 rdzenie i 40 GB SSD, rekomendując 8 GB+, 4 rdzenie+ i 80 GB+ SSD. To wymagania
Supabase; Next.js na tym samym serwerze wymaga dodatkowego zapasu i pomiarów.
[Wymagania Docker](https://supabase.com/docs/guides/self-hosting/docker).

Przed wyborem ustalamy: kto aktualizuje usługi, reaguje na awarie, odtwarza dane
i zastępuje administratora podczas nieobecności. Potrzebne są dostęp właściciela,
konfiguracja w repo, monitoring miejsca na dysku i instrukcja odtworzenia.

## Badania i backup

Backup bazy Supabase **nie zawiera plików Storage**, tylko ich metadane.
Dotyczy to także planu managed Pro. PDF-y i zdjęcia potrzebują osobnej kopii.
[Dokumentacja backupów](https://supabase.com/docs/guides/platform/backups).

W każdym wariancie sprawdzamy odzyskanie bazy, plików i ich powiązań.
Proponowany punkt wyjścia do uzgodnienia: codzienna kopia poza głównym środowiskiem
i dodatkowa kopia po dużym imporcie. Dopuszczalna utrata nowych danych i czas
odtworzenia wymagają decyzji właściciela, zanim archiwum stanie się podstawowym.

## Przenośność

Zachowujemy migracje SQL i RLS, kod Edge Functions oraz konfigurację w repo.
Nie dokładamy usług specyficznych dla hostingu bez potrzeby. Next.js można
uruchomić również samodzielnie.
[Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

Migracja nie jest samą zmianą URL: trzeba przenieść bazę, użytkowników/Auth,
pliki, konfigurację funkcji, sekrety, SMTP, harmonogramy i redirecty. Wymaga
próby odtworzenia oraz sprawdzenia sesji i dostępu do dokumentów.

## Podjęta decyzja

**Vercel Hobby + Supabase Cloud Free na początek pilotażu.** Wojtek zaakceptował ten kierunek
2026-09-28, ponieważ własny serwer jest dopiero w planach. Cel: skupić się na
produkcie, rzeczywistych badaniach czterech kotów i dostępie dla przyjaciół.

Pro + Pro nie jest wymaganiem startu. Podnosimy plan konkretnej usługi, gdy
ograniczenia użycia, charakter komercyjny (Vercel) lub wymagania utrzymania tego
wymagają. Na Free monitorujemy szczególnie 1 GB plików i 500 MB bazy, zachowujemy
oryginały badań i wykonujemy własne kopie bazy oraz plików. Uwzględniamy pauzę
projektu po tygodniu nieaktywności. Decyzja nie potwierdza jeszcze wdrożenia.

Do ustalenia przy wdrożeniu: region, środowiska, limity kosztów, wielkość archiwum
i kopie plików. Self-host lub hybrydę rozważymy ponownie po pilotażu, gdy będą
gotowy serwer, procedury utrzymania i rzeczywiste dane o kosztach.
