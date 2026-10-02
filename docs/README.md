# Care My Pet

**Care My Pet** to aplikacja webowa do zarządzania zdrowiem psów i kotów dla
właścicieli prywatnych — jedno miejsce na profil zwierzaka, historię medyczną,
szczepienia, wizyty i wyniki badań, z asystentem AI, który odczytuje wyniki z
PDF-ów i zdjęć oraz odpowiada na pytania o historię pupila.

- **Marka:** Care My Pet
- **Domena:** caremypet.pl
- **Status:** przygotowanie cichego pilotażu; M1 sprawdzone w odrębnych PoC
- **Zakres MVP:** wyłącznie właściciel prywatny (fundacje i schroniska → `IDEAS.md`, v2)

## Dokumenty

| Plik | Zawartość |
|---|---|
| `PRD.md` | Co budujemy — zakres, funkcje, user stories, co poza zakresem |
| `TECH.md` | Stack, architektura, pipeline AI, model danych |
| `HOSTING.md` | Wybór Vercel + Supabase managed, koszty i alternatywy |
| `DESIGN.md` | Identyfikacja wizualna i tokeny UI |
| `IMPLEMENTATION.md` | Fundament Signature, architektura kodu i granice aktualnego etapu |
| `ASSETS.md` | Pochodzenie zdjęć, ikon i fontów aplikacji |
| `MONETIZATION.md` | Model płatności (prepaid) i podstawa kosztowa |
| `ROADMAP.md` | Etapy P1 → P4: integracja, pilotaż i szersze otwarcie |
| `IDEAS.md` | Worek koncepcji i wszystko odłożone na v2+ |

## Zasada przewodnia

Start: cztery koty Wojtka i ich badania, następnie zaproszeni przyjaciele.
Priorytetem jest sprawdzenie zintegrowanego produktu na rzeczywistych danych.
Hosting pilotażu: Vercel Hobby + Supabase Cloud Free. Wybranym wzorcem strony
głównej jest „06 — Care My Pet Signature”. Lista oczekujących, blog i kampania
nie są warunkami rozpoczęcia pilotażu.

MVP ma być **wąskie, ale rozwijalne**. Każda decyzja w tych dokumentach jest
podjęta pod właściciela prywatnego, ale model danych i architektura nie
zamykają drogi do segmentu organizacyjnego w przyszłości.
