create table public.gospodarstwo (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id),
  nazwa text not null default 'Mój dom' check (char_length(nazwa) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.czlonek_gospodarstwa (
  gospodarstwo_id uuid not null references public.gospodarstwo(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gospodarstwo_id, user_id)
);
create index czlonek_user_idx on public.czlonek_gospodarstwa(user_id, gospodarstwo_id);

create table public.zwierze (
  id uuid primary key default gen_random_uuid(),
  gospodarstwo_id uuid not null references public.gospodarstwo(id),
  imie text not null check (char_length(btrim(imie)) between 1 and 80),
  gatunek text not null check (gatunek in ('cat', 'dog')),
  rasa text check (char_length(rasa) <= 100),
  data_urodzenia date check (data_urodzenia >= date '1900-01-01' and data_urodzenia <= current_date),
  plec text not null default 'unknown' check (plec in ('female', 'male', 'unknown')),
  kastracja boolean,
  identyfikacja text not null default 'unknown' check (identyfikacja in ('chip', 'tattoo', 'none', 'unknown')),
  numer_id text check (char_length(numer_id) <= 50),
  notatki text check (char_length(notatki) <= 4000),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identification_number check (
    (identyfikacja in ('chip', 'tattoo') and nullif(btrim(numer_id), '') is not null)
    or (identyfikacja in ('none', 'unknown') and numer_id is null)
  ),
  constraint chip_format check (identyfikacja <> 'chip' or numer_id ~ '^[0-9]{15}$')
);
create index zwierze_household_idx on public.zwierze(gospodarstwo_id, created_at);
create index zwierze_created_by_idx on public.zwierze(created_by);
create index zwierze_updated_by_idx on public.zwierze(updated_by);

alter table public.gospodarstwo enable row level security;
alter table public.czlonek_gospodarstwa enable row level security;
alter table public.zwierze enable row level security;
revoke all on public.gospodarstwo, public.czlonek_gospodarstwa, public.zwierze from anon, authenticated;
grant select, insert on public.gospodarstwo to authenticated;
grant select on public.czlonek_gospodarstwa to authenticated;
grant select, insert, update on public.zwierze to authenticated;

-- Membership reads are limited to the caller, avoiding recursive RLS policies.
-- The owner is represented by gospodarstwo.owner_id, not a duplicate membership.
create policy own_membership on public.czlonek_gospodarstwa for select to authenticated
  using (user_id = (select auth.uid()));
create policy household_read on public.gospodarstwo for select to authenticated
  using (owner_id = (select auth.uid()) or id in (
    select gospodarstwo_id from public.czlonek_gospodarstwa where user_id = (select auth.uid())
  ));
create policy household_create on public.gospodarstwo for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy pet_read on public.zwierze for select to authenticated
  using (gospodarstwo_id in (select id from public.gospodarstwo));
create policy pet_create on public.zwierze for insert to authenticated
  with check (gospodarstwo_id in (select id from public.gospodarstwo)
    and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy pet_update on public.zwierze for update to authenticated
  using (gospodarstwo_id in (select id from public.gospodarstwo))
  with check (gospodarstwo_id in (select id from public.gospodarstwo)
    and updated_by = (select auth.uid()));

create function public.stamp_pet_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.gospodarstwo_id is distinct from old.gospodarstwo_id
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Pet identity and ownership are immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function public.stamp_pet_update() from public, anon, authenticated;
create trigger stamp_pet_update before update on public.zwierze
  for each row execute function public.stamp_pet_update();

-- Atomic first-pet creation. Runs with caller privileges and all RLS policies.
-- Edge Function validates the input; DB constraints also protect direct API calls.
create function public.create_pet(p_pet jsonb) returns public.zwierze
language plpgsql security invoker set search_path = '' as $$
declare home_id uuid; result public.zwierze; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.gospodarstwo(owner_id) values (caller) on conflict (owner_id) do nothing;
  select id into strict home_id from public.gospodarstwo where owner_id = caller;
  insert into public.zwierze(gospodarstwo_id, imie, gatunek, rasa, data_urodzenia, plec,
    kastracja, identyfikacja, numer_id, notatki, created_by, updated_by)
  values (home_id, p_pet->>'imie', p_pet->>'gatunek', p_pet->>'rasa',
    (p_pet->>'data_urodzenia')::date, p_pet->>'plec', (p_pet->>'kastracja')::boolean,
    p_pet->>'identyfikacja', p_pet->>'numer_id', p_pet->>'notatki', caller, caller)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.create_pet(jsonb) from public, anon;
grant execute on function public.create_pet(jsonb) to authenticated;
