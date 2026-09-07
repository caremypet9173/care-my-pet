# TECH — Stack i architektura

**Wersja:** 0.1 (MVP)
**Data:** 2026-09-07
**Status:** Aktywny
**Powiązane:** PRD.md, ROADMAP.md

Jeden dokument dla stacku i architektury — przy managed Supabase/Vercel nie ma
tyle infrastruktury, żeby dzielić to na dwa pliki.

---

## 1. Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend / BaaS | Supabase — PostgreSQL + RLS, Auth, Storage, Edge Functions (Deno), Realtime |
| Hosting UI + Cron | Vercel |
| PWA | @ducanh2912/next-pwa + Workbox |
| Powiadomienia | VAPID Web Push (push) + Resend (email) |
| Asystent AI | Claude Sonnet 4.5 |
| Odczyt plików | Claude Haiku |
| Ekstrakcja danych z dokumentów | Gemini (Pro) |

**Typografia:** Plus Jakarta Sans (nagłówki), DM Sans (tekst).
**Kolory marki:** zieleń #1D7A4F, akcent bursztynowy #BA7517, tło kremowe #faf8f5.

---

## 2. Zasady architektury

- **Cała logika biznesowa w Supabase Edge Functions.** Vercel obsługuje wyłącznie
  UI i wyzwalacze Cron — nie trzyma logiki domenowej.
- **Auth przez Supabase** (`@supabase/ssr`), Vercel Middleware jako bramka UI.
- **Izolacja danych przez RLS.** Właściciele współdzielą jedną bazę; każdy wiersz
  ma `gospodarstwo_id`, a polityki RLS odcinają dostęp do cudzych danych na
  poziomie silnika bazy — ochrona działa nawet przy błędzie w kodzie aplikacji.
- **Storage:** osobny folder per gospodarstwo we wspólnym buckecie (wyniki badań,
  zdjęcia). Kompatybilność z S3 zostawia otwartą drogę do migracji na R2/S3.
- **Bez osobnych baz per tenant, bez Dockera/Kubernetes.** To był narzut z wizji
  „platforma dla organizacji". Dla MVP właścicielskiego managed Supabase + Vercel
  wystarcza w zupełności; złożoność dokładamy dopiero, gdy realnie wejdzie segment
  organizacyjny (v2).

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
| Docker / Kubernetes na starcie | Managed Supabase/Vercel eliminuje potrzebę własnej orkiestracji |
| Lokalny model AI (Llama/Mistral) | Słabszy odczyt PDF/obrazów, wymóg GPU, wyższy koszt przy małej skali |
| Firebase / NoSQL | Utrudnia multi-tenant z RLS; brak natywnego PostgreSQL |
