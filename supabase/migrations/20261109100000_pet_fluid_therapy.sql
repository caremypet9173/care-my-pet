-- ==============================================================================
-- Migracja: pet_fluid_therapy
-- Obsługa płynoterapii i wlewów kroplówkowych (dożylnych IV oraz podskórnych SC)
-- ==============================================================================

-- 1. Utworzenie tabeli public.pet_fluid_therapy
create table public.pet_fluid_therapy (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  fluid_name text not null check(char_length(btrim(fluid_name)) between 1 and 120),
  volume_ml numeric(6,1) not null check(volume_ml > 0 and volume_ml <= 5000),
  route text not null check(route in ('iv', 'sc', 'io')) default 'iv',
  medications_added text not null default '' check(char_length(medications_added) <= 500),
  location text not null check(location in ('clinic', 'home')) default 'clinic',
  clinic_name text not null default '' check(char_length(clinic_name) <= 120),
  doctor_name text not null default '' check(char_length(doctor_name) <= 120),
  catheter_status text not null default '' check(char_length(catheter_status) <= 200),
  administered_at timestamptz not null default now(),
  administered_on date not null check(administered_on >= date '1900-01-01' and administered_on <= (now() at time zone 'Europe/Warsaw')::date),
  notes text not null default '' check(char_length(notes) <= 1000),
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeksy pod szybkie filtrowanie i sortowanie chronologiczne
create index pet_fluid_therapy_pet_date on public.pet_fluid_therapy(pet_id, administered_on desc, created_at desc);
create index pet_fluid_therapy_household on public.pet_fluid_therapy(household_id);

-- 2. Jawne nadanie uprawnień API (wymagane od 30.10.2026 przed RLS)
grant select on public.pet_fluid_therapy to anon;
grant select, insert, update, delete on public.pet_fluid_therapy to authenticated;
grant select, insert, update, delete on public.pet_fluid_therapy to service_role;

-- 3. Row Level Security
alter table public.pet_fluid_therapy enable row level security;

create policy fluid_therapy_read on public.pet_fluid_therapy
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

create policy fluid_therapy_insert on public.pet_fluid_therapy
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

create policy fluid_therapy_update on public.pet_fluid_therapy
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

create policy fluid_therapy_delete on public.pet_fluid_therapy
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- 4. Trigger walidacji i audytu
create function public.validate_pet_fluid_therapy()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch or invalid household' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if (new.id, new.pet_id, new.household_id, new.created_by, new.created_at) is distinct from
       (old.id, old.pet_id, old.household_id, old.created_by, old.created_at) then
      raise exception 'Immutable identity' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
  else
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.revision := 1;
  end if;

  new.updated_at := now();
  return new;
end $$;

revoke all on function public.validate_pet_fluid_therapy() from public, anon, authenticated;

create trigger fluid_therapy_validate
  before insert or update on public.pet_fluid_therapy
  for each row execute function public.validate_pet_fluid_therapy();

-- 5. Funkcja RPC: save_pet_fluid_therapy
create function public.save_pet_fluid_therapy(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_fluid_name text,
  p_volume_ml numeric,
  p_route text,
  p_medications_added text,
  p_location text,
  p_clinic_name text,
  p_doctor_name text,
  p_catheter_status text,
  p_administered_at timestamptz,
  p_administered_on date,
  p_notes text
)
returns public.pet_fluid_therapy language plpgsql security invoker set search_path='' as $$
declare
  result public.pet_fluid_therapy;
  home uuid;
  effective_administered_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home from public.zwierze where id = p_pet_id;

  if p_route not in ('iv', 'sc', 'io') then
    raise exception 'Invalid route of administration' using errcode = '22023';
  end if;

  if p_location not in ('clinic', 'home') then
    raise exception 'Invalid location' using errcode = '22023';
  end if;

  if p_volume_ml <= 0 or p_volume_ml > 5000 then
    raise exception 'Volume must be between 0.1 and 5000 ml' using errcode = '22023';
  end if;

  effective_administered_at := coalesce(p_administered_at, (p_administered_on::text || ' 12:00:00')::timestamptz, now());

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 2));

  select * into result from public.pet_fluid_therapy where id = p_id;

  if p_revision = 0 then
    if found then
      if result.pet_id = p_pet_id
        and result.fluid_name = p_fluid_name
        and result.volume_ml = p_volume_ml
        and result.route = p_route
        and result.administered_on = p_administered_on
        and result.revision = 1 then
        return result;
      end if;
      raise exception 'Conflicting entry' using errcode = 'PT409';
    end if;

    insert into public.pet_fluid_therapy (
      id,
      pet_id,
      household_id,
      fluid_name,
      volume_ml,
      route,
      medications_added,
      location,
      clinic_name,
      doctor_name,
      catheter_status,
      administered_at,
      administered_on,
      notes,
      created_by
    ) values (
      p_id,
      p_pet_id,
      home,
      btrim(p_fluid_name),
      round(p_volume_ml, 1),
      p_route,
      coalesce(btrim(p_medications_added), ''),
      p_location,
      coalesce(btrim(p_clinic_name), ''),
      coalesce(btrim(p_doctor_name), ''),
      coalesce(btrim(p_catheter_status), ''),
      effective_administered_at,
      p_administered_on,
      coalesce(btrim(p_notes), ''),
      (select auth.uid())
    ) returning * into result;
  else
    update public.pet_fluid_therapy
    set fluid_name = btrim(p_fluid_name),
        volume_ml = round(p_volume_ml, 1),
        route = p_route,
        medications_added = coalesce(btrim(p_medications_added), ''),
        location = p_location,
        clinic_name = coalesce(btrim(p_clinic_name), ''),
        doctor_name = coalesce(btrim(p_doctor_name), ''),
        catheter_status = coalesce(btrim(p_catheter_status), ''),
        administered_at = effective_administered_at,
        administered_on = p_administered_on,
        notes = coalesce(btrim(p_notes), '')
    where id = p_id and pet_id = p_pet_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_pet_fluid_therapy(uuid, uuid, integer, text, numeric, text, text, text, text, text, text, timestamptz, date, text) from public, anon;
grant execute on function public.save_pet_fluid_therapy(uuid, uuid, integer, text, numeric, text, text, text, text, text, text, timestamptz, date, text) to authenticated;

-- 6. Funkcja RPC: delete_pet_fluid_therapy
create function public.delete_pet_fluid_therapy(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer
)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 2));

  delete from public.pet_fluid_therapy
  where id = p_id and pet_id = p_pet_id and revision = p_revision;

  if not found then
    raise exception 'Entry changed or unavailable' using errcode = 'PT409';
  end if;
end $$;

revoke all on function public.delete_pet_fluid_therapy(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_pet_fluid_therapy(uuid, uuid, integer) to authenticated;
