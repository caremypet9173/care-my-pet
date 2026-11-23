# Instrukcje projektu Care My Pet

## Git przez Docker

W tym projekcie wszystkie operacje Git wykonuj przez `git-shell.ps1`, który
uruchamia Git w Dockerze z konfiguracją i uwierzytelnianiem projektu.
Nie używaj bezpośrednio hostowego `git.exe` ani nie zmieniaj jego `safe.directory`.

Przykłady w PowerShell (argumenty bez dodatkowego słowa `git`):

```powershell
.\git-shell.ps1 status --short
.\git-shell.ps1 diff
.\git-shell.ps1 add -- src/sciezka-do-pliku
.\git-shell.ps1 commit -m 'feat: opis zmiany'
.\git-shell.ps1 push origin main
```

Jeśli Docker jest niedostępny, zgłoś problem zamiast przechodzić na Git hosta.
Nie wypisuj adresów remote zawierających dane uwierzytelniające.

## Vercel CLI (izolowane konto projektu)

Wszystkie operacje Vercel CLI wykonuj przez `vercel-shell.ps1`, który wymusza
izolowaną konfigurację w `.vercel/cli-auth` (oraz opcjonalny token w `.vercel/token`,
oba ignorowane przez Git), dzięki czemu nie koliduje z osobistym kontem Vercel hosta.

Przykłady w PowerShell:

```powershell
.\vercel-shell.ps1 whoami
.\vercel-shell.ps1 env ls
.\vercel-shell.ps1 ls
```

Nigdy nie wypisuj zawartości `.vercel/token` ani wartości tajnych zmiennych środowiskowych.

## Zasada krytyczna: Supabase Data API Grants dla nowych tabel (Od 30.10.2026)

W projektach opartych o Supabase od 30 października 2026 r. nowe tabele w schemacie `public` nie otrzymują już automatycznych uprawnień (grants) dla API.

**Każda nowa instrukcja `CREATE TABLE` w plikach migracji SQL MUSI być natychmiast uzupełniona o jawne nadanie uprawnień (GRANT)** dla ról `anon`, `authenticated` oraz `service_role`, zanim zostaną dopisane polityki Row Level Security (RLS).

### Wymagany szablon migracji dla nowej tabeli:

```sql
-- 1. Utworzenie tabeli
create table public.nazwa_tabeli (
    id uuid primary key default gen_random_uuid(),
    -- kolumny...
);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI)
grant select on public.nazwa_tabeli to anon;

grant select, insert, update, delete on public.nazwa_tabeli to authenticated;

grant select, insert, update, delete on public.nazwa_tabeli to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.nazwa_tabeli enable row level security;

-- 4. Definicja polityk RLS...
```

Pozostałe zasady projektu i odnośniki do dokumentacji znajdują się w `CLAUDE.md`.
