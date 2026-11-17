# Care My Pet

**Care My Pet** to aplikacja webowa (PWA) do zarządzania zdrowiem psów i kotów dla
właścicieli prywatnych — jedno miejsce na profil zwierzaka, historię medyczną,
szczepienia, wizyty, wyniki badań, pomiary, leki i płynoterapię, z asystentem AI,
który odczytuje wyniki z PDF-ów i zdjęć oraz odpowiada na pytania o historię pupila.

- **Marka:** Care My Pet
- **Domena:** caremypet.pl
- **Status:** zaawansowane przygotowanie cichego pilotażu (pełne MVP wdrożone w repo i Supabase)
- **Zakres MVP:** wyłącznie właściciel prywatny (fundacje i schroniska → `IDEAS.md`, v2)

## Dokumenty

| Plik | Zawartość |
|---|---|
| `PRD.md` | Co budujemy — zakres, funkcje, user stories, co poza zakresem |
| `TECH.md` | Stack, architektura, pipeline AI, rzeczywisty model danych |
| `HOSTING.md` | Wybór Vercel + Supabase managed, koszty i alternatywy |
| `DESIGN.md` | Identyfikacja wizualna i tokeny UI |
| `stitch/DESIGN.md` | Szczegółowe mapowanie i korekty makiet Stitch |
| `IMPLEMENTATION.md` | Fundament Signature i opis pierwszego etapu implementacji |
| `AUTH.md` | Rejestracja, logowanie, sesja i konfiguracja Auth |
| `PETS.md` | Profile zwierząt, awatary, tagi, hero i szybki przełącznik |
| `MEDICAL_REPORTS.md` | Wyniki badań, weryfikacja Split-Screen 2, badania opisowe i RAG |
| `WEIGHT.md` | Zakładka wagi i pomiarów rozwoju |
| `ASSETS.md` | Pochodzenie zdjęć, ikon i fontów aplikacji |
| `MONETIZATION.md` | Model płatności (prepaid) i podstawa kosztowa |
| `ROADMAP.md` | Etapy P1 → P4: wdrożenie, pilotaż i szersze otwarcie |
| `IDEAS.md` | Worek koncepcji i wszystko odłożone na v2+ |

## Zasada przewodnia

Start: cztery koty Wojtka i ich badania, następnie zaproszeni przyjaciele.
Priorytetem jest sprawdzenie zintegrowanego produktu na rzeczywistych danych.
Hosting pilotażu: Vercel Hobby + Supabase Cloud Free. Wybranym wzorcem strony
głównej jest „06 — Care My Pet Signature”. Dostęp do pilotażu jest kontrolowany
w bazie (`pilot_whitelist`), a zapis na listę oczekujących (`waitlist`) oraz blog
nie są warunkiem rozpoczęcia testów.

MVP ma być **wąskie, ale rozwijalne**. Każda decyzja w tych dokumentach jest
podjęta pod właściciela prywatnego, ale model danych i architektura nie
zamykają drogi do segmentu organizacyjnego w przyszłości.
