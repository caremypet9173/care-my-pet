-- ==============================================================================
-- Migracja: medication_schedules_and_logs
-- Rozbudowa modułu leków o harmonogramy oraz ewidencję podań (Care My Pet)
-- Obsługa trzech scenariuszy:
-- 1. Jednorazowe (one_off)
-- 2. Stałe codzienne (daily)
-- 3. Cykliczne interwałowe (interval: dni / tygodnie / miesiące)
-- ==============================================================================

-- 1. Tabela definicji harmonogramów leków
create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  dosage text not null default '' check (char_length(dosage) <= 120),
  schedule_type text not null check (schedule_type in ('one_off', 'daily', 'interval')),
  interval_value integer check (interval_value is null or (interval_value >= 1 and interval_value <= 365)),
  interval_unit text check (interval_unit is null or interval_unit in ('days', 'weeks', 'months')),
  start_date date not null check (start_date >= date '2000-01-01' and start_date <= date '2100-12-31'),
  end_date date check (end_date is null or (end_date >= start_date and end_date <= date '2100-12-31')),
  scheduled_time text not null default '' check (scheduled_time = '' or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  is_active boolean not null default true,
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_interval_fields check (
    (schedule_type = 'interval' and interval_value is not null and interval_unit is not null) or
    (schedule_type <> 'interval')
  )
);

-- Indeksy dla harmonogramów
create index medication_schedules_pet_idx
  on public.medication_schedules (pet_id, is_active, start_date asc);

create index medication_schedules_household_idx
  on public.medication_schedules (household_id, is_active);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.medication_schedules to anon;
grant select, insert, update, delete on public.medication_schedules to authenticated;
grant select, insert, update, delete on public.medication_schedules to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.medication_schedules enable row level security;

-- 4. Definicja polityk RLS dla harmonogramów
create policy medication_schedules_read on public.medication_schedules
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy medication_schedules_insert on public.medication_schedules
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy medication_schedules_update on public.medication_schedules
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create policy medication_schedules_delete on public.medication_schedules
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 5. Trigger walidujący dla harmonogramów
create or replace function public.validate_medication_schedule()
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

revoke all on function public.validate_medication_schedule() from public, anon, authenticated;

create trigger medication_schedule_validate
  before insert or update on public.medication_schedules
  for each row execute function public.validate_medication_schedule();

-- -----------------------------------------------------------------------------
-- 6. Tabela fizycznej ewidencji podań (medication_logs)
-- -----------------------------------------------------------------------------
create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.medication_schedules(id) on delete cascade,
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  dose_date date not null check (dose_date >= date '2000-01-01' and dose_date <= date '2100-12-31'),
  scheduled_time text not null default '' check (scheduled_time = '' or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  administered_at timestamptz not null default now(),
  status text not null default 'taken' check (status in ('taken', 'skipped')),
  administered_by uuid references auth.users(id),
  notes text not null default '' check (char_length(notes) <= 1000),
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeksy dla ewidencji podań
create index medication_logs_pet_date_idx
  on public.medication_logs (pet_id, dose_date desc, scheduled_time desc);

create index medication_logs_household_date_idx
  on public.medication_logs (household_id, dose_date desc);

-- Unikalność zatwierdzenia danej dawki harmonogramu o danej godzinie
create unique index medication_logs_schedule_dose_unique_idx
  on public.medication_logs (schedule_id, dose_date, scheduled_time)
  where schedule_id is not null;

-- 7. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.medication_logs to anon;
grant select, insert, update, delete on public.medication_logs to authenticated;
grant select, insert, update, delete on public.medication_logs to service_role;

-- 8. Włączenie RLS (Row Level Security)
alter table public.medication_logs enable row level security;

-- 9. Definicja polityk RLS dla ewidencji podań
create policy medication_logs_read on public.medication_logs
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy medication_logs_insert on public.medication_logs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy medication_logs_update on public.medication_logs
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create policy medication_logs_delete on public.medication_logs
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 10. Trigger walidujący dla ewidencji podań
create or replace function public.validate_medication_log()
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
    new.administered_by := coalesce(new.administered_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
    new.revision := 1;
  end if;

  new.updated_at := now();
  return new;
end $$;

revoke all on function public.validate_medication_log() from public, anon, authenticated;

create trigger medication_log_validate
  before insert or update on public.medication_logs
  for each row execute function public.validate_medication_log();

-- -----------------------------------------------------------------------------
-- 11. Funkcja RPC do zapisu/aktualizacji harmonogramu leku
-- -----------------------------------------------------------------------------
create or replace function public.save_medication_schedule(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_name text,
  p_dosage text,
  p_schedule_type text,
  p_interval_value integer,
  p_interval_unit text,
  p_start_date date,
  p_end_date date,
  p_scheduled_time text,
  p_instructions text,
  p_is_active boolean default true
) returns public.medication_schedules language plpgsql security invoker set search_path = '' as $$
declare
  result public.medication_schedules;
  home uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 7));

  select * into result from public.medication_schedules where id = p_id;

  if p_revision = 0 then
    if found then
      return result;
    end if;

    insert into public.medication_schedules (
      id,
      pet_id,
      household_id,
      name,
      dosage,
      schedule_type,
      interval_value,
      interval_unit,
      start_date,
      end_date,
      scheduled_time,
      instructions,
      is_active,
      created_by
    ) values (
      p_id,
      p_pet_id,
      home,
      p_name,
      p_dosage,
      p_schedule_type,
      p_interval_value,
      p_interval_unit,
      p_start_date,
      p_end_date,
      p_scheduled_time,
      p_instructions,
      p_is_active,
      auth.uid()
    ) returning * into result;
  else
    update public.medication_schedules
    set pet_id = p_pet_id,
        name = p_name,
        dosage = p_dosage,
        schedule_type = p_schedule_type,
        interval_value = p_interval_value,
        interval_unit = p_interval_unit,
        start_date = p_start_date,
        end_date = p_end_date,
        scheduled_time = p_scheduled_time,
        instructions = p_instructions,
        is_active = p_is_active
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean) from public, anon;
grant execute on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 12. Funkcja RPC do usuwania harmonogramu
-- -----------------------------------------------------------------------------
create or replace function public.delete_medication_schedule(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 7));

  delete from public.medication_schedules
  where id = p_id and pet_id = p_pet_id and revision = p_revision;

  if not found then
    raise exception 'Entry changed or unavailable' using errcode = 'PT409';
  end if;
end $$;

revoke all on function public.delete_medication_schedule(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_medication_schedule(uuid, uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Funkcja RPC do zatwierdzania podania dawki (upsert w medication_logs)
-- -----------------------------------------------------------------------------
create or replace function public.record_medication_dose(
  p_schedule_id uuid,
  p_pet_id uuid,
  p_dose_date date,
  p_scheduled_time text default '',
  p_status text default 'taken',
  p_notes text default ''
) returns public.medication_logs language plpgsql security invoker set search_path = '' as $$
declare
  result public.medication_logs;
  home uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  if p_schedule_id is not null then
    insert into public.medication_logs (
      schedule_id,
      pet_id,
      household_id,
      dose_date,
      scheduled_time,
      administered_at,
      status,
      administered_by,
      notes,
      created_by
    ) values (
      p_schedule_id,
      p_pet_id,
      home,
      p_dose_date,
      p_scheduled_time,
      now(),
      p_status,
      auth.uid(),
      p_notes,
      auth.uid()
    )
    on conflict (schedule_id, dose_date, scheduled_time)
    do update set
      status = excluded.status,
      administered_at = now(),
      administered_by = auth.uid(),
      notes = excluded.notes,
      updated_at = now()
    returning * into result;
  else
    insert into public.medication_logs (
      schedule_id,
      pet_id,
      household_id,
      dose_date,
      scheduled_time,
      administered_at,
      status,
      administered_by,
      notes,
      created_by
    ) values (
      null,
      p_pet_id,
      home,
      p_dose_date,
      p_scheduled_time,
      now(),
      p_status,
      auth.uid(),
      p_notes,
      auth.uid()
    ) returning * into result;
  end if;

  return result;
end $$;

revoke all on function public.record_medication_dose(uuid, uuid, date, text, text, text) from public, anon;
grant execute on function public.record_medication_dose(uuid, uuid, date, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 14. Funkcja RPC do anulowania / usunięcia wpisu o zatwierdzeniu podania
-- -----------------------------------------------------------------------------
create or replace function public.delete_medication_dose_log(
  p_log_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.medication_logs
  where id = p_log_id
    and household_id in (select id from public.gospodarstwo);

  if not found then
    raise exception 'Entry not found or access denied' using errcode = 'PT404';
  end if;
end $$;

revoke all on function public.delete_medication_dose_log(uuid) from public, anon;
grant execute on function public.delete_medication_dose_log(uuid) to authenticated;
