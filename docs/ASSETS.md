# Assety aplikacji

Referencja: projekt Stitch Care My Pet `1963478756572071889`, ekran
„06 — Care My Pet Signature” `b19e91a73daf435ba4c3d28e4130e215`.
Import oryginalnych obrazów z eksportu tego ekranu: 2026-10-01.

| Plik | Pochodzenie / zastosowanie |
|---|---|
| `public/media/pets-together.png` | Zdjęcie psa i kota, hero zatwierdzonego ekranu |
| `public/media/luna.png` | Portret Luny z tej samej referencji |
| `public/media/luna-cover.png` | Tło koca z „Forest — Moja Luna — Profil i podsumowanie”, ekran `72bf93de4d4043ba9dec8591de4291c0`, import 2026-10-01 |
| `public/brand/mark.png` | Ikona Forest 192 px z `assets/brand/icon/pictorial/forest` |
| `public/brand/favicon.png` | Ikona Forest 32 px z tego samego katalogu |
| `public/brand/apple-touch-icon.png` | Ikona Forest 180 px z tego samego katalogu |

Pochodzenie zdjęć z projektu Stitch potwierdzone; niezależna licencja fotografii
nie była dołączona do eksportu. Przed publikacją należy potwierdzić prawo do użycia.
Publiczne przykłady nie przedstawiają danych prawdziwego opiekuna.

Zdjęcia obsługuje `next/image`: rozmiary responsywne i negocjacja WebP/AVIF.
Interfejs nie odwołuje się do tymczasowych adresów obrazów Stitch. Centralne
ścieżki są w `src/lib/assets.ts`. Oryginały marki pozostają w `assets/brand`.

Plus Jakarta Sans i Inter: pakiety `@fontsource-variable`, licencje OFL dołączone
do pakietów. Fonty ładowane lokalnie przez `next/font/local`, z obsługą latin
i latin-ext. Nie ma zewnętrznych żądań Google Fonts podczas otwierania strony.

Przy dodawaniu nowego assetu zapisz jego pochodzenie, przeznaczenie, tekst
alternatywny i wymagane kadrowanie. Nie zastępuj zaakceptowanych zdjęć losowymi.
