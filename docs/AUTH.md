# Rejestracja i logowanie — 2026-10-14

Pierwszy etap nowej implementacji, zgodnie z decyzją właściciela. Starych PoC
nie przenosimy. Konta obsługuje Supabase Auth; nie tworzymy jeszcze tabel
domenowych, gospodarstw ani kartotek. Żadne dane demo nie stają się danymi konta.

## Zakres kodu

- `/pl/register`, `/en/register`: e-mail i hasło, powtórzenie hasła oraz Google.
- `/pl/login`, `/en/login`: logowanie hasłem lub Google.
- `/{locale}/auth/callback`: wymiana kodu PKCE na sesję.
- `/{locale}/auth/confirm`: potwierdzenie e-maila przez `token_hash`, wyłącznie typ `email`.
- `/{locale}/app`: minimalny ekran konta, weryfikacja `getUser()` na serwerze,
  wylogowanie bieżącej sesji. Proxy odświeża tokeny i przekazuje cookies.
- Ekrany Auth i prywatne odpowiedzi nie trafiają do publicznego cache.
- Formularze PL/EN, komunikaty błędów bez ujawniania istnienia konta,
  blokada wielokrotnego wysłania, walidacja przeglądarkowa.

Auth jest obsługiwane przez bibliotekę Supabase; nie wymaga własnej Edge Function.
Politykę hasła i ograniczenia liczby żądań wymusza Supabase Auth, niezależnie od UI.

## Konfiguracja usług przed rzeczywistym użyciem

1. Właściwy projekt: `lrlnqmciarjvngvquchu` (`caremypet9173's Project`),
   organizacja `caremypet9173's Org`, połączenie MCP **Care My Pet**.
   Dostęp potwierdzony 2026-10-18. `.env.local` wskazuje ten projekt;
   odczyt `/auth/v1/settings` z lokalnym kluczem publicznym zwraca HTTP 200.
   Stare połączenie **Supabase** dotyczy organizacji `AI-Coder-Enclave`;
   nie używać go do dalszych prac nad tą aplikacją.
2. Ustawić `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   Klucz secret/service_role nie jest potrzebny. `SUPABASE_JWKS_URL` nie jest
   używany — SDK weryfikuje tokeny i pobiera klucze samodzielnie.
3. W Supabase Auth włączyć Email i potwierdzanie e-maila. Minimalna długość
   hasła: 12 znaków (także na backendzie). Skonfigurować SMTP i przetestować
   dostarczenie wiadomości. Zachować limity żądań Auth.
4. W URL Configuration ustawić Site URL właściwego środowiska i dodać dokładne
   callbacki oraz adresy potwierdzenia dla obu języków, np. lokalnie:
   `http://127.0.0.1:3000/pl/auth/callback`, `/en/auth/callback`,
   `/pl/auth/confirm`, `/en/auth/confirm` (każdy z pełnym originem).
   Dla produkcji dodać odpowiedniki HTTPS. Nie używać szerokich wildcardów.
5. Szablon Confirm signup musi kierować do endpointu potwierdzenia:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=email">Potwierdź adres e-mail</a>
   ```

   `emailRedirectTo` ustawiane przez formularz zawiera język i `/auth/confirm`.
   Nie zostawiać domyślnego szablonu z `.ConfirmationURL` dla tego przepływu.
6. W Google Cloud utworzyć klienta OAuth typu Web application. Jako Authorized
   redirect URI podać `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
   Ustawić ekran zgody, a przy trybie testowym dodać użytkowników testowych.
   Client ID i Client Secret zapisać w providerze Google w Supabase Auth;
   Google Client Secret nigdy nie trafia do `.env` frontendu.
7. Sprawdzić rzeczywiste konto: rejestracja → wiadomość → potwierdzenie → konto →
   odświeżenie strony → wylogowanie → odmowa wejścia na `/app`.
   Następnie Google: zgoda → callback → konto → odświeżenie → wylogowanie;
   również anulowanie zgody, wykorzystany link i ponowna rejestracja.

Przy publikacji ustalić zakres rejestracji pilotażowej. Samo ukrycie linku nie
ogranicza zakładania kont przez API. Dokumenty prawne nadal są robocze.
Reset hasła, kasowanie konta i profile użytkownika są poza tym pierwszym etapem.

## Granice weryfikacji

### Stan sprawdzony 2026-10-18

- Projekt aktywny; dostęp MCP do bazy potwierdzony zapytaniem tylko do odczytu.
- Email włączony, rejestracja włączona, automatyczne potwierdzanie maili wyłączone
  (adres wymaga potwierdzenia). Google włączony po konfiguracji klienta OAuth.
- Utworzono testowe konto `caremypet9173@gmail.com` przez SDK z PKCE.
  Rejestracja zwróciła użytkownika bez sesji, a Supabase odnotował wysłanie
  potwierdzenia. Po kliknięciu wiadomości baza potwierdziła adres i logowanie.
  Użytkownik potwierdził logowanie hasłem, zachowanie sesji po odświeżeniu,
  wylogowanie i przekierowanie niezalogowanego z `/app` na login.
- `npm run typecheck` zakończony pomyślnie.
- Supabase CLI 2.117.0 uwierzytelniono do właściwego konta. Pracujemy przez
  Codex CLI; konfiguracja Auth nie wymaga sterowania przeglądarką.
- Przez CLI zapisano Site URL `http://127.0.0.1:3000`, osiem dokładnych
  przekierowań (PL/EN, callback/confirm, localhost/127.0.0.1 na porcie 3000)
  oraz minimalną długość hasła 12 znaków. Potwierdzanie adresu pozostaje włączone.
- Odczyt po zapisie (`config diff`) potwierdził `update: 0`. Osiem pozycji
  `remote_only` to ustawienia niezarządzane przez repo; pozostawiono je bez zmian.
- Włączono Gmail SMTP i wdrożono szablon
  `supabase/templates/confirmation.html`. CLI potwierdziło zapis konfiguracji,
  hasła aplikacji i treści szablonu. Nie zmieniano planu Supabase.
- Odczyt po wdrożeniu SMTP potwierdził `update: 0` i `local_only: 0`;
  hasło pozostaje zamaskowane przez API. Nie sprawdzono jeszcze dostarczenia maila.
- Google OAuth skonfigurowano przez CLI. `/auth/v1/settings` potwierdza
  `google: true`; `/auth/v1/authorize` z PKCE zwraca HTTP 302 do
  `accounts.google.com`, z callbackiem
  `https://lrlnqmciarjvngvquchu.supabase.co/auth/v1/callback`.
  `config diff` po wdrożeniu: `update: 0`, `local_only: 0`.
  Użytkownik przeszedł logowanie Google i pokazał ekran konta; odczyt
  `auth.identities` potwierdził dostawców `email` i `google` na tym samym koncie
  oraz logowanie Google. Użytkownik potwierdził działanie całego sprawdzanego
  interfejsu. Automatyczne logowanie po potwierdzeniu nowego adresu po poprawce
  hosta wymaga jeszcze osobnego powtórzenia na nowym koncie.
- Nagłówek i stopka pokazują „Moje konto” / „My account” przy aktywnej sesji.
  Prywatny layout przekazuje stan zweryfikowany na serwerze; strony publiczne
  aktualizują etykietę przez zdarzenia sesji Supabase bez zmiany kontroli dostępu.
  Użytkownik potwierdził poprawność tych odnośników. TypeScript, lint oraz
  24 testy Auth i lokalizacji przeszły po zmianie.
- Bezpośredni test Gmail SMTP dotarł do Odebranych (potwierdzone zrzutem).
  Wiadomość potwierdzenia wysłana przez Supabase także dotarła i została kliknięta.
- Znaleziono błąd callbacków: absolutne przekierowanie z `request.url`
  zmieniało `127.0.0.1` na `localhost`, przez co cookies nie trafiały do `/app`.
  Endpointy confirm i callback zwracają teraz względny `Location`, zachowując
  host przeglądarki. Dodano test regresji dla obu endpointów.

### Zarządzanie konfiguracją przez CLI

Repo zarządza tylko jawnymi ustawieniami w `supabase/config.toml`; nie wysyłać
domyślnej konfiguracji wygenerowanej przez `supabase init` na zdalny projekt.
Pole `project_id` jest lokalną nazwą, a właściwy projekt wybieramy jawnie:

```powershell
supabase config diff --project-ref lrlnqmciarjvngvquchu
supabase config push --project-ref lrlnqmciarjvngvquchu
supabase config diff --project-ref lrlnqmciarjvngvquchu
```

Przed `push` przejrzeć różnice. SMTP i sekcja `auth.email.template.confirmation`
są już włączone. Dostarczenie rzeczywistej wiadomości nadal wymaga testu.
Sekrety SMTP i Google nie mogą trafić do wersjonowanych plików.
Adresy produkcyjne HTTPS należy dodać po ustaleniu domeny wdrożenia.

### Wdrożona konfiguracja Gmail SMTP

Wybrany przez właściciela nadawca: `caremypet9173@gmail.com`.
W `supabase/config.toml` skonfigurowano `smtp.gmail.com`, port 587 (STARTTLS),
login i adres nadawcy jak wyżej, nazwę „Care My Pet” oraz szablon potwierdzenia.
Ustawienia wdrożono przez CLI do projektu `lrlnqmciarjvngvquchu`.

Przed wdrożeniem właściciel zapisuje hasło aplikacji Google bez spacji jako
`SUPABASE_AUTH_SMTP_PASS` w pliku `.env` w katalogu głównym repozytorium.
Plik jest ignorowany przez Git. CLI wczytuje `.env`; nie należy zakładać,
że wczyta `.env.local` używany przez Next.js. Nie używać zwykłego hasła konta.
Po dodaniu sekretu: diff, push, odczyt konfiguracji i test rzeczywistej wiadomości.
Hasło aplikacji SMTP nie jest sekretem Google OAuth — logowanie Google nadal
wymaga osobnego klienta OAuth. Klient został już skonfigurowany; CLI pobiera
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` i
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` z ignorowanego pliku `.env`.
Sekret Google nie trafia do kodu frontendu.

Testy `tests/e2e/auth.spec.ts` sprawdzają formularze, błędy i parametry PKCE
na kontrolowanych odpowiedziach API, a także realne lokalne przekierowania
serwerowe bez sesji. Nie zastępują testu dostarczenia maila, zgody Google,
utworzenia konta ani odświeżenia rzeczywistej sesji na wybranym projekcie.

Wzorce integracji: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google),
[potwierdzanie e-maila SSR](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
