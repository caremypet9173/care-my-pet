# TECH — Stack i architektura

**Wersja:** 0.2 (MVP)
**Data:** 2026-09-15
**Status:** Aktywny
**Powiązane:** PRD.md, ROADMAP.md, MONETIZATION.md, DESIGN.md

Jeden dokument dla stacku i architektury: warstwy aplikacji, dane, pipeline AI,
hosting i warstwa publiczna.

---

## 1. Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend / BaaS | Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions (Deno), Realtime |
| Hosting | self-hosted (Next.js za Cloudflare); orkiestracja K8s — patrz §7 |
| PWA | @ducanh2912/next-pwa + Workbox |
| Powiadomienia | VAPID Web Push (push) + Resend (email) |
| Asystent AI | Claude Sonnet 4.5 |
| Odczyt plików | Claude Haiku |
| Ekstrakcja danych z dokumentów | Gemini (Pro) |

**Typografia i kolory:** patrz `DESIGN.md`. UI budowany na tokenach
semantycznych (`--color-primary` itd.), nie na wartościach hex w kodzie —
motywy kolorystyczne są przełączalne.

---

## 2. Zasady architektury

- **Cała logika biznesowa w Supabase Edge Functions.** Warstwa hostingu
  (self-hosted Next.js) obsługuje wyłącznie UI i wyzwalacze Cron — nie trzyma
  logiki domenowej.
- **Auth przez Supabase** (`@supabase/ssr`), Next.js Middleware jako bramka UI.
- **Izolacja danych przez RLS.** Właściciele współdzielą jedną bazę; każdy wiersz
  ma `gospodarstwo_id`, a polityki RLS odcinają dostęp do cudzych danych na
  poziomie silnika bazy — ochrona działa nawet przy błędzie w kodzie aplikacji.
- **Storage:** osobny folder per gospodarstwo we wspólnym buckecie (wyniki badań,
  zdjęcia). Kompatybilność z S3 zostawia otwartą drogę do migracji na R2/S3.
- **Bez osobnych baz per tenant.** To był narzut z wizji „platforma dla
  organizacji". Dla MVP właścicielskiego multi-tenant przez RLS wystarcza; osobne
  bazy per tenant dokładamy dopiero, gdy realnie wejdzie segment organizacyjny (v2).
  Hosting i orkiestracja — patrz §7.

---

## 3. Pipeline AI — odczyt wyników badań

Najwyższe ryzyko techniczne projektu, więc opisane osobno.

```
plik (PDF/JPG/PNG)
   │
   ├─▶ Gemini        — ekstrakcja: { parametr, wartość, jednostka }
   │
   ├─▶ Claude Sonnet — interpretacja: walidacja norm (gatunek+wiek),
   │                    streszczenie prostym językiem, propozycja powiązania z wizytą
   │
   ▼
propozycja do ZATWIERDZENIA przez użytkownika
   │
   ▼
zapis do bazy (dopiero po potwierdzeniu)
```

**Twarda zasada:** żadna wartość nie trafia do bazy bez akceptacji użytkownika.
Interpretacja AI na ekranie wyników jest generowana **raz, przy skanie dokumentu,
i zapisywana** — nie liczona per kliknięcie. Dzięki temu jest dostępna offline i
nie generuje kosztu tokenów przy każdym otwarciu.

**Otwarte ryzyko do weryfikacji na prawdziwych dokumentach:** czy AI wiarygodnie
wyciąga wartości liczbowe z opisowych raportów (np. wymiary narządów z opisu USG).
Do walidacji ręcznej przed dopuszczeniem ekstrakcji liczbowej z opisów.

### Kontrola kosztu asystenta konwersacyjnego

Koszt zapytania zależy od tokenów, nie od liczby wiadomości, więc limit 20/dzień
nie wystarcza — trzeba ograniczyć rozmiar pojedynczego wywołania. Trzy warstwy:

- **Cap wejścia (twardy, w aplikacji).** Walidacja długości wiadomości **przed**
  wysłaniem do modelu. To musi być kod, nie instrukcja w system promptcie — koszt
  nalicza się od tego, co użytkownik wysłał, zanim model zareaguje na prompt.
- **Ograniczenie kontekstu.** Ilość historii zwierzaka doklejanej do promptu jest
  wyznaczana po stronie aplikacji, więc górny koszt zapytania jest z góry znany
  niezależnie od treści pytania.
- **Cap wyjścia.** `max_tokens` na odpowiedź ogranicza koszt generacji.

Konkretne wartości dobierane przy implementacji.

---

## 4. Model danych (szkic)

Kilkanaście tabel — struktura nieskomplikowana:

- `gospodarstwo` — jednostka izolacji (nośnik `gospodarstwo_id` dla RLS)
- `uzytkownik` — członek gospodarstwa (rola: właściciel / członek)
- `zwierze` — profil (gatunek, rasa, płeć, chip, notatki)
- `pomiar_wagi` — historia wagi
- `wizyta` — wizyty weterynaryjne
- `szczepienie`, `profilaktyka` — rejestry z terminami następnych dawek
- `lek` — historia leczenia
- `wynik_badania` + załącznik pliku
- `udostepnienie` — link/QR read-only dla weterynarza (TTL, status, log otwarć)

**Przechowywanie wyników badań:** kierunek to model znormalizowany
(`pomiar_parametru`, `slownik_parametru`, `norma_parametru`) zamiast trzymania
parametrów w JSONB — daje sensowne trendy i walidację norm. Finalizacja tego
schematu jest w toku (domykana po ustaleniu warstwy wizualnej wyników).

---

## 5. Decyzje odłożone

| Temat | Uwagi |
|---|---|
| Model Claude dla asystenta vs. koszt | Sonnet 4.5 domyślnie; obserwować koszt/jakość na realnym ruchu |
| Finalny schemat wyników (normalizacja) | Domknąć po warstwie wizualnej ekranu wyników |
| Ekstrakcja liczb z raportów opisowych | Walidacja ręczna na prawdziwych USG przed dopuszczeniem |
| Migracja Storage na R2/S3 | Dopiero jeśli koszt/skala tego wymaga |

---

## 6. Alternatywy rozważone i odrzucone

| Rozwiązanie | Dlaczego nie |
|---|---|
| Flutter + własny backend Node.js | Zbędny narzut na MVP; Next.js + Supabase daje UI i backend w jednym ekosystemie |
| Osobna baza per tenant | Multi-tenant przez RLS wystarcza dla właścicieli prywatnych |
| Lokalny model AI (Llama/Mistral) | Słabszy odczyt PDF/obrazów, wymóg GPU, wyższy koszt przy małej skali |
| Firebase / NoSQL | Utrudnia multi-tenant z RLS; brak natywnego PostgreSQL |

---

## 7. Hosting i infrastruktura

Warstwa aplikacji i danych stoi na własnej infrastrukturze (self-hosted), z Cloudflare
jako zewnętrzną warstwą brzegową — zamiast Vercel + managed Supabase.

| Warstwa | Rozwiązanie |
|---|---|
| Origin — aplikacja | Next.js self-hosted (`next start` / kontener) |
| Origin — backend / dane | Supabase self-hosted (Postgres+RLS, Auth, Storage, Edge Functions) |
| Brzeg / CDN / TLS / DDoS | Cloudflare (proxy przed origin) |
| Orkiestracja / ops | Kubernetes — prowadzony przez dev-ops (patrz *Podział ról*) |

Uzasadnienie zmiany względem założeń pierwotnych: pełna kontrola nad lokalizacją danych
medycznych (argument RODO), brak kosztów managed przy wczesnej skali oraz dostępność
kompetencji dev-ops w zespole. Wcześniejsze „bez Dockera/Kubernetes" wynikało z założenia,
że ops spada na jedną osobę bez tych kompetencji; to założenie już nie obowiązuje.
Przenośność zostaje: pod spodem to Postgres + czyste, numerowane migracje + RLS, więc
powrót na managed (lub inny hosting) pozostaje niskotarciowy.

### Podział ról

- **Aplikacja / produkt (Wojtek):** kod Next.js, logika w Edge Functions, model danych,
  migracje, warstwa AI. Właściciel decyzji produktowych.
- **Infrastruktura / ops (dev-ops):** klaster K8s, deploymenty, sieć, TLS, monitoring,
  backupy, bezpieczeństwo serwerów.

**Twarda zasada:** infrastruktura idzie za potrzebami produktu, nie odwrotnie. W konflikcie
„dowieźć MVP" vs „rozbudować infra" rozstrzyga właściciel produktu.

### Zabezpieczenia (warunki wejścia w self-host na K8s)

Bus factor infrastruktury jest realny — poniższe są obowiązkowe, nie opcjonalne:

- **Infra jako kod, w repo.** Manifesty K8s, konfiguracja klastra, IaC — w repozytorium,
  nie na prywatnym dysku. Cała infrastruktura odtwarzalna bez dostępu do jednej osoby.
- **Runbook odtworzeniowy.** Krótki dokument: gdzie to stoi, jak zrobić redeploy, jak
  odtworzyć z backupu, gdzie są sekrety. Cel: brak bezradności w awarii i możliwość
  przekazania ops komuś innemu.
- **Backupy bazy weryfikowane przez właściciela.** Wojtek niezależnie potwierdza, że
  backupy istnieją i dają się odtworzyć. Backup niezweryfikowany = nieistniejący.
- **RODO / umowa powierzenia.** Dev-ops ma dostęp root do danych medycznych obywateli UE
  → wymagana umowa powierzenia przetwarzania i jasny zakres odpowiedzialności
  administrator / procesor.

### Cache i warstwy (Cloudflare)

Domyślnie Cloudflare cache'uje tylko statyczne assety, **nie HTML** — bezpieczny punkt
startu. Reguły jawne:

| Ścieżka | Cache |
|---|---|
| `/_next/static/*` (assety z hashem) | Agresywnie, immutable |
| `/`, `/blog/*`, `/cennik` (publiczne, statyczne) | Tak — ISR + jawna reguła |
| `/app/*` (panel, za auth) | Nigdy — bypass |
| Pliki badań (signed URLs, TTL) | Nigdy — prywatne, jednorazowe |

Dodatkowy pas bezpieczeństwa: bypass cache przy obecności cookie sesji.
**Zasada nadrzędna:** domyślnie bypass, jawnie whitelistuj publiczne — nie odwrotnie.

Pliki z badaniami nie przechodzą przez publiczny cache. Serwowane przez signed URLs
z krótkim TTL z Supabase Storage, wyłącznie zalogowanemu właścicielowi / weterynarzowi
(read-only link z TTL z modelu danych, §4).

### Co spada na nas przy self-hoście Next (na managed było automatyczne)

- **`next/image`** — wymaga `sharp` na origin (albo offloadu), inaczej optymalizacja
  obrazów obciąża Node origin.
- **ISR przy >1 instancji** — potrzebny współdzielony cache handler, żeby instancje się
  nie rozjechały (przy 1 instancji nieistotne).
- **Edge Middleware** — wykona się w runtime Node, nie na brzegu (funkcjonalnie OK).
- **Cron** — deklaratywny cron zastąpiony systemowym / mechanizmem klastra.

---

## 8. Warstwa publiczna (landing + blog)

Domyka odwołanie do „zewnętrznego CMS" i webhooka z §7.

### Rozdział warstw

Produkt ma dwie warstwy w **jednym projekcie Next.js**, nie dwa osobne projekty:

- **Warstwa publiczna** — landing + blog na `caremypet.pl`. Publiczna, statyczna,
  indeksowana. Cel: pozyskanie organiczne (SEO) i zaufanie.
- **Aplikacja** — panel opiekuna (`login → panel`). Prywatna, dynamiczna, za auth.

Rozdział realizujemy przez **route groups**, nie przez osobny deployment. Next per-trasa
dzieli kod sam — odwiedzający landing nie pobiera JS-a panelu (bez ręcznego lazy-loadingu).

**Dlaczego content jest tu ważniejszy niż w typowym SaaS:** odbiorca to użytkownik
okazjonalny (jeden zwierzak, 2–3 wizyty/rok), który nie szuka „aplikacji", ale wpisuje
w Google objawy i wyniki badań pupila. Artykuły trafiają w moment potrzeby i prowadzą
do produktu, który te wyniki interpretuje.

### Struktura tras

```
app/
  (marketing)/           # publiczne, statyczne, indeksowane
    layout.tsx           #   nagłówek/stopka marki, nawigacja publiczna
    page.tsx             #   "/"          → landing
    blog/
      page.tsx           #   "/blog"      → lista artykułów
      [slug]/page.tsx    #   "/blog/..."  → pojedynczy artykuł
    cennik/page.tsx      #   "/cennik"    → z MONETIZATION.md
  (auth)/
    login/page.tsx       #   "/login"
  (app)/                 # prywatne, dynamiczne, za auth
    layout.tsx           #   powłoka panelu, wymaga sesji Supabase
    app/...              #   "/app/..."   → panel opiekuna
```

Nawiasy w nazwach folderów **nie** wchodzą do URL-a — grupują trasy i przypinają osobny
`layout.tsx`. Jedno repo, jeden deploy, wspólne tokeny marki — trzy światy z osobnymi powłokami.

### Strategia renderowania

| Warstwa | Render | Indeksowanie |
|---|---|---|
| `(marketing)` — landing | Statycznie (SSG) | Tak |
| `(marketing)` — blog | Statycznie + ISR (rewalidacja przy publikacji) | Tak |
| `(app)` — panel | Dynamicznie, per-request, za auth | `noindex` |

Warstwa publiczna cache'owana na brzegu Cloudflare (patrz §7): szybka, tania, crawlowalna.
Panel nigdy nie trafia do cache brzegowego.

### CMS bloga — Sanity

Blog prowadzi **osoba nietechniczna**, więc treść nie może iść przez commity w Git
(MDX w repo odpada). Zasilamy blog z zewnętrznego headless CMS.

**Wybór: Sanity.** Hostowany, prawdziwy edytor, workflow draft → publish, role, CDN na
obrazki, dobra integracja z Next.

**Twarda zasada — izolacja danych.** Autor treści zostaje **całkowicie poza Supabase**.
Dostaje wyłącznie login do CMS-a; nigdy nie ma konta w bazie z danymi medycznymi. To nie
tylko wygoda pisania — to zawężenie powierzchni dostępu do danych wrażliwych (bezpieczeństwo
i RODO). Trzymanie artykułów w Supabase wymagałoby dania autorowi konta do tej samej bazy —
świadomie tego unikamy.

**Alternatywa — Payload 3** (Next-native, self-hostowalny). Odrzucona dla MVP: podpięty pod
*ten sam* Supabase traci argument izolacji (wymuszałby osobną bazę) i dokłada ops. Sanity
daje izolację „za darmo" i zero utrzymania.

### Publikacja treści a cache brzegowy

Publikacja musi domknąć cache na brzegu — inaczej wpis nie pojawi się do wygaśnięcia TTL:

```
CMS publish → webhook → rewalidacja ISR na origin → purge cache Cloudflare dla ścieżki (API CF)
```

Blog pozostaje statyczny (ISR), a nowy artykuł jest live w kilka sekund po publikacji,
bez redeployu i bez udziału programisty.

**Workflow treści zdrowotnych:** autor tworzy **szkice**; publikacja wymaga akceptacji
właściciela (lub powiadomienia). Merytorycznie błędny artykuł o wynikach badań nie może
trafić na produkcję bez rewizji — to marka i odpowiedzialność właściciela, nie autora.

### SEO i zgodność — do wbudowania od dnia pierwszego

- `generateMetadata` per strona (tytuł, opis, OG).
- `sitemap.ts` i `robots.ts` (panel wykluczony z indeksu).
- Schema **JSON-LD `Article`** na wpisach bloga.
- OG-image z assetów marki (`assets/brand/` — gotowe lockupy w trzech wariantach).
- Reużywalny komponent `<Disclaimer>` pod artykuły zdrowotne („to nie zastępuje wizyty
  u weterynarza"). Pozycjonujemy treść jako „pomożemy zrozumieć", nie „postawimy diagnozę".

### Czego ta warstwa NIE zmienia

- **Schemat Supabase — nietknięty.** CMS jest zewnętrzny; treść bloga nie ma reprezentacji
  w bazie aplikacji (model danych §4 bez zmian).
- **Zakres funkcjonalny aplikacji — bez zmian.** Warstwa publiczna to strumień
  marketingowo-contentowy równoległy do MVP, nie nowa funkcja panelu.
