---
name: pilot-manager
description: Manage closed pilot whitelist and waitlist submissions directly in Supabase (list pending signups, approve candidates, reject, manage whitelist). Use whenever the user asks about pilot signups, waitlist status, approving or rejecting candidates, or whitelisting testers.
---

# Pilot Manager Skill

Ten skill służy do administracji zamkniętym pilotażem i listą oczekujących (waitlist) aplikacji CareMyPet bezpośrednio w produkcyjnej/zdalnej bazie Supabase, bez konieczności logowania się do panelu Supabase Studio.

## Szybkie użycie

Zarządzanie odbywa się za pomocą dołączonego skryptu pomocniczego:
```powershell
node .agents/skills/pilot-manager/scripts/pilot.mjs <komenda> [argumenty]
```

Dostępne komendy:
* **`list`**: Wyświetla wszystkie zgłoszenia z waitlisty ze statusem (`pending`, `invited`, `rejected`), liczbą pupili i datą zgłoszenia.
* **`whitelist`**: Wyświetla wszystkich testerów z aktywnym uprawnieniem do rejestracji w pilotażu (`public.pilot_whitelist`).
* **`approve <email>`**: Zatwierdza kandydata z waitlisty:
  1. Wstawia adres e-mail do `public.pilot_whitelist` z notatką o liczbie pupili.
  2. Zmienia status zgłoszenia w `public.waitlist` na `invited`.
* **`reject <email>`**: Oznacza zgłoszenie w `public.waitlist` jako `rejected`.
* **`add <email> [notatka]`**: Bezpośrednio dodaje adres do `public.pilot_whitelist` (np. zaproszony znajomy bez wcześniejszego zapisu na waitliście).
* **`remove <email>`**: Usuwa adres z `public.pilot_whitelist`.

## Przykłady interakcji z użytkownikiem

1. **Użytkownik:** *"Kto zapisał się na pilotaż?"* lub *"Pokaż nowe zgłoszenia"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs list`
   * Zwróć użytkownikowi czytelną tabelę markdown z e-mailami, statusem i liczbą pupili.

2. **Użytkownik:** *"Zatwierdź brombs@o2.pl"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs approve brombs@o2.pl`
   * Potwierdź sukces operacji.

3. **Użytkownik:** *"Kto jest na białej liście?"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs whitelist`
   * Wyświetl listę uprawnionych kont.

4. **Użytkownik:** *"Dodaj testera test@example.com jako weterynarza"*
   * Uruchom: `node .agents/skills/pilot-manager/scripts/pilot.mjs add test@example.com "Lekarz weterynarii"`
   * Potwierdź dodanie.
