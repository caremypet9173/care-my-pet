# IDEAS — Worek koncepcji

> Ten dokument nie jest częścią specyfikacji MVP. To miejsce na wszystko, co
> świadomie odłożone, oraz na luźne pomysły. Nic tu nie jest zobowiązaniem.

---

## Segment organizacyjny (v2) — wycięte z MVP, ale realne

Cała ta warstwa pochodzi z pierwotnej, szerszej wizji. Wartościowa, ale to osobny
produkt względem MVP właścicielskiego — wraca, gdy rdzeń się sprawdzi.

- **Konta organizacyjne i role:** Admin, Koordynator, Wolontariusz, Dom
  tymczasowy, Weterynarz — z audytowalnością wpisów.
- **Domy tymczasowe:** przypisywanie zwierzaka, historia opiekunów, przekazanie
  opieki z automatycznym dostępem do historii.
- **Proces adopcji:** statusy (Zainteresowany / Weryfikacja / Umowa /
  Zaadoptowany), rejestracja adopcjonerów, archiwizacja profilu.
- **Publiczne profile adopcyjne:** strona bez logowania z kartami zwierząt
  gotowych do adopcji; osadzanie jako widget/iframe na stronie organizacji.
- **Ewidencja i raporty:** dashboard wg statusu, eksport CSV/PDF na sprawozdania
  i granty; dla schronisk — ewidencja przyjęć/wydań i raporty dla Inspekcji
  Weterynaryjnej wg Ustawy o zdrowiu zwierząt.
- **Izolacja danych organizacji:** wtedy wraca temat mocniejszej izolacji niż RLS
  (osobne bazy / bucket per organizacja) — świadomie wycięty z MVP.
- **Model płatności dla organizacji:** skalowany od liczby podopiecznych, plan
  non-profit ze zniżką.

## Kontekst prawny (pod v2 organizacyjne)

- **Ustawa o zdrowiu zwierząt** (obowiązuje od 18.03.2026): schroniska jako
  „zakłady", obowiązek rejestracji w Inspekcji Weterynaryjnej i ewidencji.
- **KROPiK** (w toku legislacyjnym): obowiązkowe czipowanie i rejestracja psów w
  centralnym rejestrze (ARiMR); koty przy zmianie właściciela. Stąd numer chipa
  jako pole standardowe już w MVP — tanie przygotowanie na przyszłą integrację.

## Pomysły funkcjonalne (do rozważenia kiedyś)

- **Wizytówka zwierzaka** — publiczny profil do udostępniania rodzinie i
  znajomym; galeria, podstawowe dane, własny link (np. `caremypet.pl/burek`),
  właściciel kontroluje widoczność.
- **Oś zdrowia z kamieniami emocjonalnymi** — rocznice adopcji, „kapsuły pamięci"
  obok zdarzeń medycznych na wspólnej osi czasu.
- **Śledzenie trendów parametrów** — wykresy wartości badań w czasie; potencjalny
  płatny upsell.
- **Dyktowanie wyników głosem** do asystenta AI.
- **Transfer kartoteki** fundacja → właściciel prywatny po adopcji (import jednym
  kliknięciem, jeśli nowy właściciel ma konto).
- **Program partnerski dla weterynarzy** jako kanał dystrybucji.
- **Wielojęzyczność** (np. ukraiński, angielski) — istotne przy wolontariuszach.
- **Powiadomienia SMS** obok push i email.
- **Moderator AI dla asystenta** — osobny model przepuszczający wiadomości i
  blokujący konwersacje spoza domeny / próby nadużycia. W MVP wystarcza system
  prompt + capy długości; moderator to hardening na v2 (dokłada koszt i złożoność:
  każda wiadomość przechodzi przez drugi model).
- **Kolejne gatunki** poza psem i kotem.
- **Integracja z kalendarzem systemowym** (Google Calendar).
