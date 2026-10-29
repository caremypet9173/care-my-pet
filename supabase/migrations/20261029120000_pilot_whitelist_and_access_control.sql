-- Tabela białej listy pilotażowej
create table if not exists public.pilot_whitelist (
  email text primary key check (char_length(email) between 3 and 254),
  created_at timestamptz not null default now(),
  notes text default ''
);

-- Indeks na małe litery email
create index if not exists pilot_whitelist_lower_idx on public.pilot_whitelist(lower(email));

-- 2. Jawne nadanie uprawnień dla API (zgodnie z regułą AGENTS.md)
grant select on public.pilot_whitelist to anon;
grant select, insert, update, delete on public.pilot_whitelist to authenticated;
grant select, insert, update, delete on public.pilot_whitelist to service_role;

-- 3. Włączenie RLS
alter table public.pilot_whitelist enable row level security;

-- 4. Polityki RLS
create policy pilot_whitelist_read on public.pilot_whitelist for select to authenticated
  using (true);

create policy pilot_whitelist_admin_all on public.pilot_whitelist for all to authenticated
  using (
    exists (
      select 1 from public.gospodarstwo g
      where g.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.gospodarstwo g
      where g.owner_id = (select auth.uid())
    )
  );

-- 5. Automatyczne zasilenie istniejącymi użytkownikami z auth.users
insert into public.pilot_whitelist (email, notes)
select lower(u.email), 'Istniejący użytkownik'
from auth.users u
where u.email is not null and u.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
on conflict (email) do nothing;

-- 6. Funkcja sprawdzająca uprawnienia do pilotażu (Opcja 2: uwzględnia też zaproszenia współopiekunów)
create or replace function public.check_pilot_access(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_norm text := lower(btrim(p_email));
  v_is_whitelisted boolean := false;
  v_has_invitation boolean := false;
  v_has_account boolean := false;
begin
  if v_norm is null or v_norm = '' or v_norm !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return jsonb_build_object('eligible', false, 'reason', 'invalid_email');
  end if;

  select exists(select 1 from public.pilot_whitelist where lower(email) = v_norm) into v_is_whitelisted;
  select exists(select 1 from public.zaproszenie_gospodarstwa where lower(email) = v_norm and status in ('pending', 'accepted')) into v_has_invitation;
  select exists(select 1 from auth.users where lower(email) = v_norm) into v_has_account;

  if v_is_whitelisted or v_has_invitation or v_has_account then
    return jsonb_build_object(
      'eligible', true,
      'has_account', v_has_account,
      'is_invitation', v_has_invitation and not v_is_whitelisted
    );
  else
    return jsonb_build_object(
      'eligible', false,
      'reason', 'not_whitelisted'
    );
  end if;
end;
$$;

revoke all on function public.check_pilot_access(text) from public, anon;
grant execute on function public.check_pilot_access(text) to anon, authenticated, service_role;

-- 7. Funkcja pomocnicza do dodawania e-maila do pilotażu przez właściciela gospodarstwa
create or replace function public.add_pilot_email(p_email text, p_notes text default '')
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_norm text := lower(btrim(p_email));
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists(select 1 from public.gospodarstwo where owner_id = v_caller) then
    raise exception 'Owner permission required' using errcode = '42501';
  end if;

  if v_norm is null or v_norm !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into public.pilot_whitelist (email, notes)
  values (v_norm, coalesce(p_notes, ''))
  on conflict (email) do update
  set notes = excluded.notes;

  return true;
end;
$$;

revoke all on function public.add_pilot_email(text, text) from public, anon;
grant execute on function public.add_pilot_email(text, text) to authenticated;
