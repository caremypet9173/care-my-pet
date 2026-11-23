-- Migracja: rozszerzenie gospodarstw o konta rodzinne, członków i zaproszenia

-- 1. Rozszerzenie czlonek_gospodarstwa o rolę i zapisany adres e-mail
alter table public.czlonek_gospodarstwa
  add column if not exists rola text not null default 'member' check (rola in ('admin', 'member')),
  add column if not exists email text;

-- Uprawnienia dla czlonek_gospodarstwa
grant select, insert, update, delete on public.czlonek_gospodarstwa to authenticated;
grant select, insert, update, delete on public.czlonek_gospodarstwa to service_role;

-- Aktualizacja polityk RLS dla czlonek_gospodarstwa
drop policy if exists own_membership on public.czlonek_gospodarstwa;
drop policy if exists membership_select on public.czlonek_gospodarstwa;
drop policy if exists membership_insert on public.czlonek_gospodarstwa;
drop policy if exists membership_update on public.czlonek_gospodarstwa;
drop policy if exists membership_delete on public.czlonek_gospodarstwa;

create policy membership_select on public.czlonek_gospodarstwa for select to authenticated
  using (
    user_id = (select auth.uid())
    or gospodarstwo_id in (select id from public.gospodarstwo)
  );

create policy membership_insert on public.czlonek_gospodarstwa for insert to authenticated
  with check (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
  );

create policy membership_update on public.czlonek_gospodarstwa for update to authenticated
  using (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
  );

create policy membership_delete on public.czlonek_gospodarstwa for delete to authenticated
  using (
    user_id = (select auth.uid())
    or gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
  );

-- 2. Uprawnienia i polityka aktualizacji dla gospodarstwo (zmiana nazwy przez właściciela)
grant update on public.gospodarstwo to authenticated;
grant select, insert, update, delete on public.gospodarstwo to service_role;

drop policy if exists household_update on public.gospodarstwo;
create policy household_update on public.gospodarstwo for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3. Tabela zaproszeń do gospodarstwa
create table public.zaproszenie_gospodarstwa (
  id uuid primary key default gen_random_uuid(),
  gospodarstwo_id uuid not null references public.gospodarstwo(id) on delete cascade,
  email text not null check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  token text not null unique,
  rola text not null default 'member' check (rola in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_by uuid not null references auth.users(id),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

-- Indeksy dla zaproszeń
create index zaproszenie_household_idx on public.zaproszenie_gospodarstwa(gospodarstwo_id, status);
create index zaproszenie_token_idx on public.zaproszenie_gospodarstwa(token);
create index zaproszenie_email_idx on public.zaproszenie_gospodarstwa(lower(email), status);

-- Jawne nadanie uprawnień dla API (obowiązkowo przed RLS, zgodnie z AGENTS.md)
grant select on public.zaproszenie_gospodarstwa to anon;
grant select, insert, update, delete on public.zaproszenie_gospodarstwa to authenticated;
grant select, insert, update, delete on public.zaproszenie_gospodarstwa to service_role;

-- Włączenie RLS
alter table public.zaproszenie_gospodarstwa enable row level security;

-- Polityki RLS dla zaproszeń
create policy zaproszenie_select on public.zaproszenie_gospodarstwa for select to authenticated
  using (
    gospodarstwo_id in (select id from public.gospodarstwo)
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy zaproszenie_insert on public.zaproszenie_gospodarstwa for insert to authenticated
  with check (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
    and created_by = (select auth.uid())
  );

create policy zaproszenie_update on public.zaproszenie_gospodarstwa for update to authenticated
  using (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy zaproszenie_delete on public.zaproszenie_gospodarstwa for delete to authenticated
  using (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
  );
