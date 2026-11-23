# Polityka Prywatności aplikacji Care My Pet

Data wejścia w życie: 6 października 2026 r.  
Wersja: 1.0

---

## 1. Informacje ogólne i Administrator Danych

1. Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych Użytkowników korzystających z aplikacji internetowej i mobilnej **Care My Pet** (dalej: „Aplikacja”), dostępnej pod adresem domeny [care-my-pet-flax.vercel.app](https://care-my-pet-flax.vercel.app).
2. Administratorem danych osobowych Użytkowników w rozumieniu Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO) jest:
   * **Wojciech Dobrowolski**, prowadzący działalność gospodarczą pod firmą **DOBROWOLSKI WOJCIECH**[cite: 1],
   * Adres siedziby: **ul. Mikołaja Kopernika 20 lok. 8, 21-040 Świdnik, Polska**[cite: 1],
   * NIP: **7132283642**[cite: 1],
   * REGON: **060126310**[cite: 1],
   * Organ rejestrowy: Centralna Ewidencja i Informacja o Działalności Gospodarczej (CEIDG) prowadzona przez ministra właściwego ds. gospodarki[cite: 1],
   * Adres poczty elektronicznej (kontakt w sprawach prywatności): **caremypet9173@gmail.com**[cite: 2].
3. Administrator dokłada szczególnej staranności w celu ochrony interesów osób, których dane dotyczą, zapewniając zgodność z zasadami legalności, rzetelności, przejrzystości, minimalizacji danych oraz integralności i poufności.

---

## 2. Zakres zbieranych danych

W ramach świadczenia usług Aplikacja gromadzi i przetwarza:

1. **Dane konta Użytkownika:**
   * Adres e-mail (niezbędny do identyfikacji, uwierzytelnienia oraz wysyłki powiadomień transakcyjnych)[cite: 2],
   * Identyfikator konta (UUID) nadawany w strukturze bazy danych,
   * Zaszyfrowane hasło dostępu (zarządzane i chronione za pośrednictwem modułu Supabase Auth)[cite: 2].
2. **Dane profili zwierząt domowych:**
   * Dane identyfikacyjne i cechy: imię, gatunek, rasa, data urodzenia / wiek, płeć, waga, numer mikroczipu[cite: 2],
   * Historia medyczna i profilaktyczna: ewidencja szczepień, odrobaczeń, zabiegów, alergii, przyjmowanych leków, przebytych chorób oraz indywidualne notatki opiekuńcze[cite: 2].  
   *(Dane dotyczące zwierząt nie stanowią danych osobowych w świetle art. 4 pkt 1 RODO, podlegają jednak tożsamym standardom poufności jako integralna zawartość Konta Użytkownika)*[cite: 2].
3. **Załączniki i dokumentacja:**
   * Zdjęcia zwierząt, skany wypisów z lecznic weterynaryjnych, wyniki badań laboratoryjnych, zdjęcia rentgenowskie oraz rachunki[cite: 2], które mogą zawierać dane osób trzecich (np. lekarza weterynarii lub placówki leczniczej).
4. **Dane techniczne i eksploatacyjne:**
   * Adresy IP, identyfikatory sesji, logi dostępu, typ przeglądarki, system operacyjny urządzenia oraz metryki wydajności generowane podczas komunikacji z infrastrukturą sieciową[cite: 2].

---

## 3. Cele i podstawy prawne przetwarzania danych

| Cel przetwarzania | Zakres danych | Podstawa prawna (RODO) | Okres przechowywania |
| :--- | :--- | :--- | :--- |
| **Prowadzenie Konta i świadczenie usług Aplikacji** (wirtualna książeczka zdrowia, terminarz opieki) | Adres e-mail, UUID, profile zwierząt, notatki | **Art. 6 ust. 1 lit. b RODO** (wykonanie umowy o świadczenie usług)[cite: 2] | Przez cały okres istnienia aktywnego Konta Użytkownika[cite: 2] |
| **Przechowywanie załączników i dokumentacji weterynaryjnej** | Pliki PDF, zdjęcia, wypisy medyczne[cite: 2] | **Art. 6 ust. 1 lit. b RODO** (wykonanie umowy)[cite: 2] | Wieloletnia archiwizacja przez okres trwania Konta lub do samodzielnego usunięcia pliku[cite: 1, 2] |
| **Wsparcie odczytu dokumentów przez moduł AI (Google Gemini)** | Treści przesłanych plików, fragmenty notatek | **Art. 6 ust. 1 lit. b RODO** (realizacja funkcji usługi na żądanie)[cite: 2] | Wyłącznie na czas przetworzenia zapytania API; brak trwałego zapisu w pamięci operacyjnej modelu |
| **Zapewnienie bezpieczeństwa teleinformatycznego i diagnostyka błędów** | Adres IP, logi serwerowe, nagłówki HTTP[cite: 2] | **Art. 6 ust. 1 lit. f RODO** (prawnie uzasadniony interes Administratora)[cite: 2] | Przez okres niezbędny do analizy bezpieczeństwa (zgodnie z retencją logów, do 90 dni)[cite: 2] |
| **Obrona przed roszczeniami lub ich dochodzenie** | Dane konta, historia operacji w Aplikacji[cite: 2] | **Art. 6 ust. 1 lit. f RODO** (prawnie uzasadniony interes Administratora)[cite: 2] | Do upływu prawnego terminu przedawnienia roszczeń[cite: 2] |

---

## 4. Wykorzystanie sztucznej inteligencji (Google Gemini API)

1. Aplikacja udostępnia funkcje analityczne wspierane przez wielomodalne modele sztucznej inteligencji rodziny **Google Gemini** (dostarczane przez Google Cloud / Google Ireland Limited / Google LLC).
2. Moduł AI uruchamiany jest wyłącznie w wyniku bezpośredniej akcji Użytkownika (np. zgłoszenie prośby o odczytanie wypisu weterynaryjnego lub wyodrębnienie dat szczepień z załączonego skanu).
3. **Brak trenowania modeli publicznych:** Przetwarzanie danych odbywa się za pośrednictwem płatnego interfejsu programistycznego (API). Zgodnie z polityką przetwarzania danych dostawcy technologii, zapytania (prompty), zdjęcia i dokumenty przesyłane do Google Gemini API **nie są wykorzystywane do trenowania ani ulepszania publicznych modeli sztucznej inteligencji**.
4. Wszelkie sugestie, wyciągi i podsumowania wygenerowane przez moduł AI mają charakter wyłącznie pomocniczy i nie stanowią diagnozy weterynaryjnej.

---

## 5. Odbiorcy danych i podmioty przetwarzające (Procesorzy)

W celu zapewnienia bezawaryjnego funkcjonowania Aplikacji Administrator powierza przetwarzanie danych następującym zaufanym dostawcom technologicznym:

1. **Supabase Inc.** (USA / Singapur):
   * Zakres: Zarządzanie relacyjną bazą danych PostgreSQL, mechanizmy uwierzytelniania Użytkowników (Supabase Auth) oraz bezpieczny magazyn plików (Supabase Storage)[cite: 2].
   * Lokalizacja instancji bazy danych: Region Unii Europejskiej (np. Frankfurt am Main, Niemcy).
2. **Vercel Inc.** (USA):
   * Zakres: Hosting warstwy front-endowej, routing, globalna sieć dystrybucji treści (CDN) oraz bezserwerowe funkcje brzegowe (Serverless / Edge Functions)[cite: 2].
3. **Google LLC / Google Ireland Limited** (USA / Irlandia):
   * Zakres: Przetwarzanie zapytań sztucznej inteligencji i odczyt tekstu ze zdjęć za pośrednictwem Google Gemini API.
4. **Dostawcy poczty elektronicznej (np. Resend / SendGrid / Amazon SES):**
   * Zakres: Wysyłka wiadomości transakcyjnych (weryfikacja adresu e-mail, resetowanie hasła, powiadomienia systemowe)[cite: 2].

---

## 6. Przekazywanie danych poza Europejski Obszar Gospodarczy (EOG)

Z uwagi na korzystanie z infrastruktury dostawców z siedzibą w Stanach Zjednoczonych (Supabase Inc., Vercel Inc., Google LLC), dane Użytkowników mogą być przekazywane do państw trzecich[cite: 1, 2]. Transfer ten odbywa się z zachowaniem najwyższych wymogów prawnych Rozdziału V RODO w oparciu o:
* Uczestnictwo podmiotów w programie **EU-US Data Privacy Framework** (potwierdzającym adekwatny stopień ochrony danych osobowych na terenie USA)[cite: 1, 2],
* **Standardowe Klauzule Umowne (SCC)** zatwierdzone przez Komisję Europejską, zaimplementowane w umowach powierzenia przetwarzania danych (DPA)[cite: 1, 2],
* Środki techniczne w postaci szyfrowania danych w tranzycie (TLS 1.3) oraz w spoczynku (AES-256).

---

## 7. Prawa Użytkownika

Zgodnie z przepisami RODO każdemu Użytkownikowi przysługuje:
* **Prawo dostępu do danych** oraz otrzymania ich kopii (art. 15 RODO)[cite: 2],
* **Prawo do sprostowania** (poprawienia) nieprawidłowych lub niekompletnych danych (art. 16 RODO)[cite: 2],
* **Prawo do usunięcia danych** („prawo do bycia zapomnianym”, art. 17 RODO) – realizowane bezpośrednio w panelu Konta lub na żądanie mailowe[cite: 2],
* **Prawo do ograniczenia przetwarzania** (art. 18 RODO)[cite: 2],
* **Prawo do przenoszenia danych** w powszechnie stosowanym formacie maszynowym (np. JSON, CSV) (art. 20 RODO)[cite: 2],
* **Prawo do wniesienia sprzeciwu** wobec przetwarzania danych realizowanego na podstawie prawnie uzasadnionego interesu (art. 21 RODO)[cite: 2].

W celu realizacji swoich uprawnień Użytkownik może skorzystać z opcji dostępnych w Aplikacji lub wysłać wiadomość na adres: **caremypet9173@gmail.com**[cite: 2].

Każdy Użytkownik ma również prawo wnieść skargę do właściwego organu nadzorczego:  
**Prezes Urzędu Ochrony Danych Osobowych (PUODO)**, ul. Stawki 2, 00-193 Warszawa[cite: 2].

---

## 8. Pliki cookies i technologie lokalne

1. Aplikacja nie stosuje zewnętrznych ciasteczek śledzących, analitycznych profilujących ani marketingowych sieci reklamowych[cite: 2].
2. Aplikacja wykorzystuje wyłącznie techniczne pliki cookies oraz mechanizmy pamięci przeglądarki (`Local Storage`, `Session Storage`):
   * Bezpieczne ciasteczka sesyjne (`HttpOnly`, `Secure`, `SameSite`) obsługujące tokeny autoryzacyjne Supabase Auth[cite: 2],
   * Pamięć lokalną przeglądarki służącą do zapamiętania preferencji interfejsu (np. preferowany motyw graficzny)[cite: 2].

---

## 9. Zmiany w Polityce Prywatności oraz zmiana Administratora

1. Administrator zastrzega sobie prawo do aktualizacji Polityki Prywatności w związku z rozwojem technologicznym Aplikacji lub zmianą obowiązujących przepisów prawa[cite: 2].
2. O wszelkich modyfikacjach Użytkownicy zostaną powiadomieni drogą elektroniczną lub za pośrednictwem komunikatu w Aplikacji z wyprzedzeniem co najmniej **14 dni** przed datą wejścia zmian w życie[cite: 2].
3. **Sukcesja i przeniesienie praw:** W przypadku planowanego przekształcenia formy prawnej, utworzenia nowego podmiotu gospodarczego lub zbycia praw do Aplikacji na rzecz innej jednostki powiązanej z Administratorem, status Administratora Danych Osobowych przejdzie na następcę prawnego, o czym Użytkownicy zostaną poinformowani z co najmniej 14-dniowym wyprzedzeniem z prawem do usunięcia Konta.