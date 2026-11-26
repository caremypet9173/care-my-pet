---
name: pilot-manager
description: Manage closed pilot whitelist and waitlist submissions directly in Supabase (list pending signups, approve candidates, reject, manage whitelist, send pilot welcome emails). Use whenever the user asks about pilot signups, waitlist status, approving or rejecting candidates, whitelisting testers, or sending pilot welcome emails.
---

# Pilot Manager Skill

Ten skill służy do administracji zamkniętym pilotażem i listą oczekujących (waitlist) aplikacji CareMyPet bezpośrednio w produkcyjnej/zdalnej bazie Supabase, bez konieczności logowania się do panelu Supabase Studio.

## Szybkie użycie

Zarządzanie odbywa się za pomocą dołączonego skryptu pomocniczego:
```powershell
node .agents/skills/pilot-manager/scripts/pilot.mjs <komenda> [argumenty] [flagi]
```

Dostępne komendy:
* **`list`**: Wyświetla wszystkie zgłoszenia z waitlisty ze statusem (`pending`, `invited`, `rejected`), liczbą pupili i datą zgłoszenia.
* **`whitelist`**: Wyświetla wszystkich testerów z aktywnym uprawnieniem do rejestracji w pilotażu (`public.pilot_whitelist`) wraz z datą wysłania maila powitalnego (`welcome_sent_at`).
* **`approve <email> [--no-email] [--force] [--locale=pl|en]`**: Zatwierdza kandydata z waitlisty:
  1. Wstawia adres e-mail do `public.pilot_whitelist` z notatką o liczbie pupili.
  2. Zmienia status zgłoszenia w `public.waitlist` na `invited`.
  3. Domyślnie wysyła e-mail powitalny przez Edge Function `schedule-notifications` (`action: "pilot_welcome"`) i zapisuje `welcome_sent_at` (pomiń flagą `--no-email`).
* **`reject <email>`**: Oznacza zgłoszenie w `public.waitlist` jako `rejected`.
* **`add <email> [notatka] [--no-email] [--force] [--locale=pl|en]`**: Bezpośrednio dodaje adres do `public.pilot_whitelist` i domyślnie wysyła e-mail powitalny (pomiń flagą `--no-email`).
* **`welcome <email1> [email2 ...] [--dry-run] [--force] [--locale=pl|en]`**: Wysyła e-mail powitalny z linkiem rejestracyjnym do wybranych adresów obecnych na `public.pilot_whitelist` (chroni przed duplikatami przez `welcome_sent_at`; `--force` wymusza ponowną wysyłkę, `--dry-run` zwraca podgląd bez wysyłki).
* **`remove <email>`**: Usuwa adres z `public.pilot_whitelist`.

## Przykłady interakcji z użytkownikiem

1. **Użytkownik:** *"Kto zapisał się na pilotaż?"* lub *"Pokaż nowe zgłoszenia"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs list`
   * Zwróć użytkownikowi czytelną tabelę markdown z e-mailami, statusem i liczbą pupili.

2. **Użytkownik:** *"Zatwierdź brombs@o2.pl"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs approve brombs@o2.pl`
   * Potwierdź nadanie dostępu i wysłanie maila powitalnego (lub podaj flagę `--no-email`, jeśli użytkownik poprosił bez wysyłki).

3. **Użytkownik:** *"Wyślij maila powitalnego do brombs@o2.pl"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs welcome brombs@o2.pl`
   * Potwierdź wynik wysyłki i zaktualizowany `welcome_sent_at`.

4. **Użytkownik:** *"Kto jest na białej liście?"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs whitelist`
   * Wyświetl listę uprawnionych kont wraz ze statusem wysyłki maila powitalnego.

5. **Użytkownik:** *"Dodaj testera test@example.com jako weterynarza"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs add test@example.com "Lekarz weterynarii"`
   * Potwierdź dodanie i wysłanie maila powitalnego.
