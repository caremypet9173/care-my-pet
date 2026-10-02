# TECH — Stack i architektura

**Wersja:** 0.3 (MVP / pilotaż)
**Data:** 2026-09-28
**Status:** Aktywny
**Powiązane:** PRD.md, ROADMAP.md, MONETIZATION.md, DESIGN.md

Jeden dokument dla stacku i architektury: warstwy aplikacji, dane, pipeline AI,
hosting i warstwa publiczna.

---

## 1. Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Tabler Icons; komponenty Signature |
| Backend / BaaS | Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions (Deno), Realtime |
| Hosting | Vercel (Next.js) + Supabase managed (backend i pliki) — patrz HOSTING.md |
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
  (Vercel lub własny Next.js) obsługuje wyłącznie UI i wyzwalacze Cron — nie trzyma
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

## 7. Hosting i infrastruktura — Vercel + Supabase managed

**Decyzja 2026-09-28:** pilotaż na Vercel Hobby + Supabase Cloud Free.
Własny serwer jest dopiero w planach. Dostępność potencjalnego administratora
pozostaje atutem przy ewentualnej późniejszej migracji.

Uzasadnienie i porównanie: [HOSTING.md](HOSTING.md). Wybór architektury nie oznacza
jeszcze utworzenia usług ani zakupu płatnych planów.

Next.js działa na Vercel; baza, Auth, Storage i Edge Functions w Supabase managed.
AI i poczta są osobnymi usługami. Logika domenowa pozostaje w Edge Functions;
konfigurację wyzwalaczy Cron ustalimy przy wdrożeniu.

### Utrzymanie i ewentualny późniejszy self-host

W pilotażu dostawcy utrzymują infrastrukturę usług; po naszej stronie pozostają
kod, konfiguracja dostępu, kontrola kosztów i odtworzenie danych wraz z kopiami
plików. Poniższy podział z administratorem dotyczy dopiero własnego hostingu.

Wojtek odpowiada za produkt, kod, model danych i AI. Administrator za uzgodniony
zakres aktualizacji, sieci, TLS, monitoringu, backupów i odtwarzania.
Konfiguracja wersjonowana, sekrety poza repo; właściciel ma dostęp i instrukcję
odtworzenia niezależną od dostępności administratora. Backup obejmuje bazę
**i pliki badań**, z testem odtworzenia.

K8s nie jest wymaganiem. Propozycja dla jednego serwera: Docker Compose.
Istniejący, utrzymywany klaster można wykorzystać po ocenie kosztu.
Dostęp administratora i faktycznych dostawców uwzględniamy w dokumentach
prywatności. Lokalizacja serwera nie opisuje przepływu danych do dostawców AI.

### Cache

Panel, odpowiedzi sesyjne i badania nie trafiają do publicznego cache.
Publiczne assety mogą być cache'owane. TTL linku nie oznacza jednorazowości.
Self-host wymaga konfiguracji reverse proxy, TLS, obrazów i harmonogramów;
wiele instancji wymaga uzgodnienia cache i rewalidacji.
[Dokumentacja Next.js](https://nextjs.org/docs/app/guides/self-hosting).

## 8. Strona główna i późniejsza warstwa publiczna

Wybrana strona główna: „06 — Care My Pet Signature” ze Stitch (2026-10-01).
Fundament frontendu i publiczne demo są wdrożone lokalnie w repo; logowanie
i zaproszenia wymagają integracji backendu. Lista oczekujących, cennik i blog
nie są wymagane. Zakres pierwszej implementacji opisuje `IMPLEMENTATION.md`.
Ukrycie rejestracji lub noindex nie zastępuje kontroli dostępu w backendzie.

Kierunek: jeden projekt Next.js, wspólne tokeny marki, osobne route groups dla
strony głównej, logowania i panelu. Panel pod /app/*, za autoryzacją, z noindex.
Route groups nie pojawiają się w URL.

### Po decyzji o publicznym otwarciu

- Landing pozostaje jedną z opcji; wtedy wraca temat bloga i SEO.
- Sanity pozostaje dotychczasowym wyborem CMS dla osoby nietechnicznej.
  Autor treści nie otrzymuje dostępu do bazy kartotek.
- Metadane, sitemap, Article JSON-LD, podglądy społecznościowe oraz informacja,
  że treści zdrowotne nie zastępują konsultacji z weterynarzem.
- Artykuły jako szkice; publikacja po przeglądzie właściciela.
- CMS wyzwala rewalidację; przy cache Cloudflare także unieważnienie na brzegu.
- Zakres aplikacji bez zmian: właściciele prywatni, psy i koty.

tmp/brief-zmian-landing.md to historyczna propozycja pre-launch, nie bieżący zakres.
