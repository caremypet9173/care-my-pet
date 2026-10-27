-- 1. Utworzenie tabeli wątków rozmów z Asystentem AI
create table public.pet_assistant_thread (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pet_assistant_thread_pet_idx
  on public.pet_assistant_thread (pet_id, updated_at desc);

create index pet_assistant_thread_household_idx
  on public.pet_assistant_thread (household_id);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_assistant_thread to anon;

grant select, insert, update, delete on public.pet_assistant_thread to authenticated;

grant select, insert, update, delete on public.pet_assistant_thread to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.pet_assistant_thread enable row level security;

-- 4. Definicja polityk RLS dla wątków (brak polityki DELETE — rozmowy są zachowywane)
create policy assistant_thread_read on public.pet_assistant_thread
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy assistant_thread_insert on public.pet_assistant_thread
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy assistant_thread_update on public.pet_assistant_thread
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create or replace function public.validate_pet_assistant_thread()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.validate_pet_assistant_thread() from public, anon, authenticated;

create trigger assistant_thread_validate
  before insert or update on public.pet_assistant_thread
  for each row execute function public.validate_pet_assistant_thread();

-- 5. Rozszerzenie pet_assistant_message o thread_id oraz follow_ups
alter table public.pet_assistant_message
  add column thread_id uuid references public.pet_assistant_thread(id) on delete cascade,
  add column follow_ups jsonb not null default '[]'::jsonb check (jsonb_typeof(follow_ups) = 'array');

-- Migracja istniejących wiadomości do wątków (po jednym wątku na zwierzaka, jeśli były już wiadomości)
do $$
declare
  rec record;
  v_thread_id uuid;
begin
  for rec in
    select distinct on (pet_id)
      pet_id,
      household_id,
      created_by,
      left(btrim(content), 120) as first_title,
      min(created_at) over (partition by pet_id) as first_created_at,
      max(created_at) over (partition by pet_id) as last_created_at
    from public.pet_assistant_message
    where thread_id is null
    order by pet_id, created_at asc
  loop
    insert into public.pet_assistant_thread (
      pet_id,
      household_id,
      title,
      created_by,
      created_at,
      updated_at
    ) values (
      rec.pet_id,
      rec.household_id,
      coalesce(nullif(rec.first_title, ''), 'Rozmowa z asystentem'),
      rec.created_by,
      rec.first_created_at,
      rec.last_created_at
    ) returning id into v_thread_id;

    update public.pet_assistant_message
    set thread_id = v_thread_id
    where pet_id = rec.pet_id and thread_id is null;
  end loop;
end $$;

alter table public.pet_assistant_message
  alter column thread_id set not null;

create index pet_assistant_message_thread_idx
  on public.pet_assistant_message (thread_id, created_at asc);

-- Usunięcie polityki kasowania wiadomości — historia rozmów jest zachowywana
drop policy if exists assistant_message_delete on public.pet_assistant_message;
