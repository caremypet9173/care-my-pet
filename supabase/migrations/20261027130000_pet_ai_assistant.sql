-- 1. Quota na wiadomości Asystenta AI (20 wiadomości / dzień UTC na użytkownika)
create table private.ai_assistant_quota (
  user_id uuid references auth.users(id) on delete cascade,
  day date,
  used integer not null,
  primary key (user_id, day)
);

alter table private.ai_assistant_quota enable row level security;
revoke all on private.ai_assistant_quota from public, anon, authenticated;

create or replace function private.take_ai_assistant_quota()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  count integer;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    return null;
  end if;

  insert into private.ai_assistant_quota (user_id, day, used)
  values (auth.uid(), (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, day) do update
    set used = private.ai_assistant_quota.used + 1
  where private.ai_assistant_quota.used < 20
  returning used into count;

  return count;
end $$;

revoke all on function private.take_ai_assistant_quota() from public, anon;
grant execute on function private.take_ai_assistant_quota() to authenticated;

create or replace function public.take_ai_assistant_quota()
returns integer language sql security invoker set search_path = '' as $$
  select private.take_ai_assistant_quota()
$$;

revoke all on function public.take_ai_assistant_quota() from public, anon;
grant execute on function public.take_ai_assistant_quota() to authenticated;

create or replace function private.get_ai_assistant_quota_used()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select used from private.ai_assistant_quota
     where user_id = auth.uid() and day = (now() at time zone 'UTC')::date),
    0
  );
$$;

revoke all on function private.get_ai_assistant_quota_used() from public, anon;
grant execute on function private.get_ai_assistant_quota_used() to authenticated;

create or replace function public.get_ai_assistant_quota_used()
returns integer language sql stable security invoker set search_path = '' as $$
  select private.get_ai_assistant_quota_used()
$$;

revoke all on function public.get_ai_assistant_quota_used() from public, anon;
grant execute on function public.get_ai_assistant_quota_used() to authenticated;

-- 2. Utworzenie tabeli historii czatu Asystenta AI
create table public.pet_assistant_message (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index pet_assistant_message_pet_idx
  on public.pet_assistant_message (pet_id, created_at asc);

create index pet_assistant_message_household_idx
  on public.pet_assistant_message (household_id);

-- 3. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_assistant_message to anon;

grant select, insert, update, delete on public.pet_assistant_message to authenticated;

grant select, insert, update, delete on public.pet_assistant_message to service_role;

-- 4. Włączenie RLS (Row Level Security)
alter table public.pet_assistant_message enable row level security;

-- 5. Definicja polityk RLS
create policy assistant_message_read on public.pet_assistant_message
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy assistant_message_insert on public.pet_assistant_message
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy assistant_message_delete on public.pet_assistant_message
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 6. Walidacja przynależności pupila do gospodarstwa przy zapisie
create or replace function public.validate_pet_assistant_message()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch' using errcode = '42501';
  end if;
  new.created_by := auth.uid();
  new.created_at := coalesce(new.created_at, now());
  return new;
end $$;

revoke all on function public.validate_pet_assistant_message() from public, anon, authenticated;

create trigger assistant_message_validate
  before insert on public.pet_assistant_message
  for each row execute function public.validate_pet_assistant_message();
