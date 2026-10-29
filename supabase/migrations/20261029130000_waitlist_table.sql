-- 1. Tabela listy oczekujących (Waitlist)
create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null check (char_length(email) between 3 and 254),
  pets_count integer not null default 1 check (pets_count between 1 and 50),
  notes text default '',
  status text not null default 'pending' check (status in ('pending', 'invited', 'rejected')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint waitlist_email_key unique (email)
);

-- Indeks na małe litery email
create index if not exists waitlist_lower_email_idx on public.waitlist (lower(email));

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO zgodnie z AGENTS.md)
grant select, insert on public.waitlist to anon;
grant select, insert, update, delete on public.waitlist to authenticated;
grant select, insert, update, delete on public.waitlist to service_role;

-- 3. Włączenie RLS
alter table public.waitlist enable row level security;

-- 4. Polityki RLS
-- Każdy (zarówno anonimowy gość jak i zalogowany) może zapisać się na listę z poprawnym adresem email
create policy waitlist_insert_all on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and pets_count between 1 and 50
  );

-- Właściciel gospodarstwa może przeglądać, aktualizować i usuwać wpisy z listy oczekujących
create policy waitlist_admin_all on public.waitlist
  for all
  to authenticated
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

-- 5. Funkcja RPC do bezpiecznego zapisu na listę oczekujących (upsert)
create or replace function public.add_waitlist_entry(p_email text, p_pets_count integer default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm_email text := lower(btrim(p_email));
  v_count integer := coalesce(p_pets_count, 1);
begin
  if v_norm_email is null or v_norm_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  if v_count < 1 or v_count > 50 then
    v_count := 1;
  end if;

  insert into public.waitlist (email, pets_count, status)
  values (v_norm_email, v_count, 'pending')
  on conflict (email) do update
  set pets_count = excluded.pets_count;

  return true;
end;
$$;

revoke all on function public.add_waitlist_entry(text, integer) from public;
grant execute on function public.add_waitlist_entry(text, integer) to anon, authenticated, service_role;

-- 6. Funkcja pomocnicza RPC do szybkiej aktywacji zgłoszenia z listy oczekujących do pilotażu
create or replace function public.approve_waitlist_entry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_entry record;
  v_norm_email text;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists(select 1 from public.gospodarstwo where owner_id = v_caller) then
    raise exception 'Owner permission required' using errcode = '42501';
  end if;

  select * into v_entry from public.waitlist where id = p_id;
  if not found then
    return false;
  end if;

  v_norm_email := lower(btrim(v_entry.email));

  -- Dodaj do białej listy pilotażowej
  insert into public.pilot_whitelist (email, notes)
  values (v_norm_email, 'Z listy oczekujących (' || v_entry.pets_count || ' pupili)')
  on conflict (email) do update
  set notes = excluded.notes;

  -- Oznacz status w waitlist jako zaproszony
  update public.waitlist
  set status = 'invited'
  where id = p_id;

  return true;
end;
$$;

revoke all on function public.approve_waitlist_entry(uuid) from public, anon;
grant execute on function public.approve_waitlist_entry(uuid) to authenticated;
