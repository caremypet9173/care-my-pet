-- 1. Utworzenie tabeli zaplanowanych terminów i wizyt (Terminarz domowy)
create table public.pet_schedule_item (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  category text not null check (category in ('visit', 'vaccination', 'prevention')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  scheduled_date date not null check (scheduled_date >= date '2000-01-01' and scheduled_date <= date '2100-12-31'),
  scheduled_time text not null default '' check (scheduled_time = '' or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  clinic text not null default '' check (char_length(clinic) <= 120),
  doctor text not null default '' check (char_length(doctor) <= 120),
  prep_notes text not null default '' check (char_length(prep_notes) <= 2000),
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  completed_event_id uuid references public.pet_health_event(id) on delete set null,
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pet_schedule_item_pet_date_idx
  on public.pet_schedule_item (pet_id, scheduled_date asc, created_at desc);

create index pet_schedule_item_household_date_idx
  on public.pet_schedule_item (household_id, status, scheduled_date asc);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_schedule_item to anon;

grant select, insert, update, delete on public.pet_schedule_item to authenticated;

grant select, insert, update, delete on public.pet_schedule_item to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.pet_schedule_item enable row level security;

-- 4. Definicja polityk RLS
create policy schedule_item_read on public.pet_schedule_item
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy schedule_item_insert on public.pet_schedule_item
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy schedule_item_update on public.pet_schedule_item
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create policy schedule_item_delete on public.pet_schedule_item
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 5. Trigger walidujący przynależność pupila do gospodarstwa i wersjonowanie
create or replace function public.validate_pet_schedule_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if (new.id, new.household_id, new.created_by, new.created_at)
       is distinct from (old.id, old.household_id, old.created_by, old.created_at) then
      raise exception 'Immutable identity' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.revision := 1;
  end if;

  new.updated_at := now();
  return new;
end $$;

revoke all on function public.validate_pet_schedule_item() from public, anon, authenticated;

create trigger schedule_item_validate
  before insert or update on public.pet_schedule_item
  for each row execute function public.validate_pet_schedule_item();

-- 6. Funkcja RPC do zapisu/edycji pozycji terminarza
create or replace function public.save_pet_schedule_item(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_category text,
  p_title text,
  p_scheduled_date date,
  p_scheduled_time text,
  p_clinic text,
  p_doctor text,
  p_prep_notes text,
  p_status text default 'planned'
) returns public.pet_schedule_item language plpgsql security invoker set search_path = '' as $$
declare
  result public.pet_schedule_item;
  home uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 5));

  select * into result from public.pet_schedule_item where id = p_id;

  if p_revision = 0 then
    if found then
      if result.pet_id = p_pet_id
         and result.created_by = auth.uid()
         and result.category = p_category
         and result.title = p_title
         and result.scheduled_date = p_scheduled_date
         and result.scheduled_time = p_scheduled_time
         and result.clinic = p_clinic
         and result.doctor = p_doctor
         and result.prep_notes = p_prep_notes
         and result.status = p_status
         and result.revision = 1 then
        return result;
      end if;
      raise exception 'Conflicting entry' using errcode = 'PT409';
    end if;

    insert into public.pet_schedule_item (
      id,
      pet_id,
      household_id,
      category,
      title,
      scheduled_date,
      scheduled_time,
      clinic,
      doctor,
      prep_notes,
      status,
      created_by
    ) values (
      p_id,
      p_pet_id,
      home,
      p_category,
      p_title,
      p_scheduled_date,
      p_scheduled_time,
      p_clinic,
      p_doctor,
      p_prep_notes,
      p_status,
      auth.uid()
    ) returning * into result;
  else
    update public.pet_schedule_item
    set pet_id = p_pet_id,
        category = p_category,
        title = p_title,
        scheduled_date = p_scheduled_date,
        scheduled_time = p_scheduled_time,
        clinic = p_clinic,
        doctor = p_doctor,
        prep_notes = p_prep_notes,
        status = p_status
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_pet_schedule_item(uuid, uuid, integer, text, text, date, text, text, text, text, text) from public, anon;
grant execute on function public.save_pet_schedule_item(uuid, uuid, integer, text, text, date, text, text, text, text, text) to authenticated;

-- 7. Funkcja RPC do usuwania pozycji terminarza
create or replace function public.delete_pet_schedule_item(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 5));

  delete from public.pet_schedule_item
  where id = p_id and pet_id = p_pet_id and revision = p_revision;

  if not found then
    raise exception 'Entry changed or unavailable' using errcode = 'PT409';
  end if;
end $$;

revoke all on function public.delete_pet_schedule_item(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_pet_schedule_item(uuid, uuid, integer) to authenticated;
