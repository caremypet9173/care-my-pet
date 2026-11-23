-- ==============================================================================
-- Migracja: fluid_therapy_schedules
-- Rozszerzenie harmonogramów (medication_schedules) o cykliczną płynoterapię / kroplówki
-- oraz automatyczną synchronizację z tabelą public.pet_fluid_therapy.
-- ==============================================================================

-- 1. Rozszerzenie tabeli medication_schedules o metadane płynoterapii
alter table public.medication_schedules
  add column if not exists schedule_category text not null default 'medication'
    check (schedule_category in ('medication', 'fluid_therapy')),
  add column if not exists fluid_name text not null default ''
    check (char_length(fluid_name) <= 120),
  add column if not exists fluid_volume_ml numeric(6,1)
    check (fluid_volume_ml is null or (fluid_volume_ml > 0 and fluid_volume_ml <= 5000)),
  add column if not exists fluid_route text not null default 'sc'
    check (fluid_route in ('iv', 'sc', 'io')),
  add column if not exists fluid_location text not null default 'home'
    check (fluid_location in ('clinic', 'home'));

-- 2. Powiązanie wpisów płynoterapii z logiem zatwierdzenia dawki harmonogramu
alter table public.pet_fluid_therapy
  add column if not exists medication_log_id uuid
    references public.medication_logs(id) on delete cascade;

create unique index if not exists pet_fluid_therapy_med_log_uidx
  on public.pet_fluid_therapy(medication_log_id);

-- 3. Usunięcie poprzednich przeciążeń save_medication_schedule, aby uniknąć niejednoznaczności PostgREST
drop function if exists public.save_medication_schedule(
  uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean
);
drop function if exists public.save_medication_schedule(
  uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[]
);
drop function if exists public.save_medication_schedule(
  uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[], numeric, numeric, text
);

-- 4. Zaktualizowana funkcja RPC save_medication_schedule (z obsługą płynoterapii)
create function public.save_medication_schedule(
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
  p_is_active boolean default true,
  p_scheduled_times text[] default '{}',
  p_stock_quantity numeric default null,
  p_low_stock_threshold numeric default 5,
  p_stock_unit text default 'dawek',
  p_schedule_category text default 'medication',
  p_fluid_name text default '',
  p_fluid_volume_ml numeric default null,
  p_fluid_route text default 'sc',
  p_fluid_location text default 'home'
) returns public.medication_schedules language plpgsql security invoker set search_path = '' as $$
declare
  result public.medication_schedules;
  home uuid;
  v_times text[];
  v_main_time text;
  v_category text;
  v_fluid_name text;
  v_fluid_volume numeric(6,1);
  v_fluid_route text;
  v_fluid_location text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 7));

  -- Wyznaczenie tablicy godzin i głównej godziny
  if p_scheduled_times is not null and cardinality(p_scheduled_times) > 0 then
    v_times := p_scheduled_times;
    v_main_time := coalesce(nullif(p_scheduled_time, ''), p_scheduled_times[1], '');
  elsif p_scheduled_time is not null and p_scheduled_time <> '' then
    v_times := array[p_scheduled_time];
    v_main_time := p_scheduled_time;
  else
    v_times := '{}';
    v_main_time := '';
  end if;

  v_category := coalesce(nullif(btrim(p_schedule_category), ''), 'medication');
  if v_category not in ('medication', 'fluid_therapy') then
    raise exception 'Invalid schedule category' using errcode = '22023';
  end if;

  if v_category = 'fluid_therapy' then
    v_fluid_name := left(coalesce(nullif(btrim(p_fluid_name), ''), btrim(p_name)), 120);
    v_fluid_volume := case
      when p_fluid_volume_ml is not null and p_fluid_volume_ml > 0
        then greatest(0.1, least(5000, round(p_fluid_volume_ml, 1)))
      else null
    end;
    v_fluid_route := coalesce(nullif(btrim(p_fluid_route), ''), 'sc');
    v_fluid_location := coalesce(nullif(btrim(p_fluid_location), ''), 'home');
  else
    v_fluid_name := '';
    v_fluid_volume := null;
    v_fluid_route := 'sc';
    v_fluid_location := 'home';
  end if;

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
      scheduled_times,
      instructions,
      is_active,
      stock_quantity,
      low_stock_threshold,
      stock_unit,
      schedule_category,
      fluid_name,
      fluid_volume_ml,
      fluid_route,
      fluid_location,
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
      v_main_time,
      v_times,
      p_instructions,
      p_is_active,
      p_stock_quantity,
      coalesce(p_low_stock_threshold, 5),
      coalesce(nullif(btrim(p_stock_unit), ''), 'dawek'),
      v_category,
      v_fluid_name,
      v_fluid_volume,
      v_fluid_route,
      v_fluid_location,
      (select auth.uid())
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
        scheduled_time = v_main_time,
        scheduled_times = v_times,
        instructions = p_instructions,
        is_active = p_is_active,
        stock_quantity = p_stock_quantity,
        low_stock_threshold = coalesce(p_low_stock_threshold, 5),
        stock_unit = coalesce(nullif(btrim(p_stock_unit), ''), 'dawek'),
        schedule_category = v_category,
        fluid_name = v_fluid_name,
        fluid_volume_ml = v_fluid_volume,
        fluid_route = v_fluid_route,
        fluid_location = v_fluid_location
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_medication_schedule(
  uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[], numeric, numeric, text, text, text, numeric, text, text
) from public, anon;

grant execute on function public.save_medication_schedule(
  uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[], numeric, numeric, text, text, text, numeric, text, text
) to authenticated, service_role;

-- 5. Zaktualizowana funkcja record_medication_dose:
--    - przywraca ochronę przed zapisem przyszłych dawek,
--    - zachowuje dekrementację/przywracanie zapasu,
--    - synchronizuje powiązany wpis w public.pet_fluid_therapy dla schedule_category = 'fluid_therapy'.
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
  prev_status text;
  today_date date;
  sched public.medication_schedules;
  v_clean_time text;
  v_admin_at timestamptz;
  v_fluid_name text;
  v_volume numeric(6,1);
  v_route text;
  v_location text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  today_date := (now() at time zone 'Europe/Warsaw')::date;
  if p_dose_date > today_date then
    raise exception 'Cannot record medication dose for future dates' using errcode = '22000';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  if p_schedule_id is not null then
    select * into sched
    from public.medication_schedules
    where id = p_schedule_id and pet_id = p_pet_id;

    if not found then
      raise exception 'Schedule not found or access denied' using errcode = 'PT404';
    end if;

    -- Sprawdź poprzedni status dla tej dawki (jeśli istniał)
    select status into prev_status
    from public.medication_logs
    where schedule_id = p_schedule_id
      and dose_date = p_dose_date
      and scheduled_time = coalesce(p_scheduled_time, '');

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
      coalesce(p_scheduled_time, ''),
      now(),
      p_status,
      (select auth.uid()),
      coalesce(p_notes, ''),
      (select auth.uid())
    )
    on conflict (schedule_id, dose_date, scheduled_time)
    do update set
      status = excluded.status,
      administered_at = now(),
      administered_by = (select auth.uid()),
      notes = excluded.notes,
      updated_at = now()
    returning * into result;

    -- Aktualizacja stanu magazynowego jeśli status zmienił się na 'taken'
    if p_status = 'taken' and (prev_status is null or prev_status <> 'taken') then
      update public.medication_schedules
      set stock_quantity = greatest(0, stock_quantity - 1)
      where id = p_schedule_id and stock_quantity is not null and stock_quantity > 0;
    -- Przywrócenie stanu jeśli zmieniono z 'taken' na 'skipped'
    elsif p_status = 'skipped' and prev_status = 'taken' then
      update public.medication_schedules
      set stock_quantity = stock_quantity + 1
      where id = p_schedule_id and stock_quantity is not null;
    end if;

    -- Synchronizacja z historią płynoterapii, jeśli harmonogram dotyczy kroplówek
    if sched.schedule_category = 'fluid_therapy' then
      if p_status = 'taken' then
        v_fluid_name := left(coalesce(nullif(btrim(sched.fluid_name), ''), btrim(sched.name)), 120);
        v_volume := greatest(0.1, least(5000, coalesce(round(sched.fluid_volume_ml, 1), 100)));
        v_route := case when sched.fluid_route in ('iv', 'sc', 'io') then sched.fluid_route else 'sc' end;
        v_location := case when sched.fluid_location in ('clinic', 'home') then sched.fluid_location else 'home' end;

        v_clean_time := coalesce(nullif(btrim(p_scheduled_time), ''), nullif(btrim(sched.scheduled_time), ''), '');
        if p_dose_date = today_date then
          v_admin_at := now();
        elsif v_clean_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          v_admin_at := ((p_dose_date::text || ' ' || v_clean_time || ':00')::timestamp at time zone 'Europe/Warsaw');
        else
          v_admin_at := ((p_dose_date::text || ' 12:00:00')::timestamp at time zone 'Europe/Warsaw');
        end if;

        insert into public.pet_fluid_therapy (
          pet_id,
          household_id,
          fluid_name,
          volume_ml,
          route,
          medications_added,
          location,
          administered_at,
          administered_on,
          notes,
          medication_log_id,
          created_by
        ) values (
          p_pet_id,
          home,
          v_fluid_name,
          v_volume,
          v_route,
          left(coalesce(btrim(sched.instructions), ''), 500),
          v_location,
          v_admin_at,
          p_dose_date,
          left(coalesce(btrim(p_notes), ''), 1000),
          result.id,
          (select auth.uid())
        )
        on conflict (medication_log_id)
        do update set
          fluid_name = excluded.fluid_name,
          volume_ml = excluded.volume_ml,
          route = excluded.route,
          medications_added = excluded.medications_added,
          location = excluded.location,
          administered_at = excluded.administered_at,
          administered_on = excluded.administered_on,
          notes = excluded.notes;
      elsif p_status = 'skipped' then
        delete from public.pet_fluid_therapy
        where medication_log_id = result.id;
      end if;
    end if;
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
      coalesce(p_scheduled_time, ''),
      now(),
      p_status,
      (select auth.uid()),
      coalesce(p_notes, ''),
      (select auth.uid())
    ) returning * into result;
  end if;

  return result;
end $$;

revoke all on function public.record_medication_dose(uuid, uuid, date, text, text, text) from public, anon;
grant execute on function public.record_medication_dose(uuid, uuid, date, text, text, text) to authenticated, service_role;

-- 6. Zaktualizowana funkcja delete_pet_fluid_therapy czyszcząca powiązany log dawki (jeśli istnieje)
create or replace function public.delete_pet_fluid_therapy(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer
)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_med_log_id uuid;
  v_schedule_id uuid;
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 2));

  delete from public.pet_fluid_therapy
  where id = p_id and pet_id = p_pet_id and revision = p_revision
  returning medication_log_id into v_med_log_id;

  if not found then
    raise exception 'Entry changed or unavailable' using errcode = 'PT409';
  end if;

  if v_med_log_id is not null then
    select schedule_id, status into v_schedule_id, v_status
    from public.medication_logs
    where id = v_med_log_id;

    if found then
      delete from public.medication_logs where id = v_med_log_id;
      if v_status = 'taken' and v_schedule_id is not null then
        update public.medication_schedules
        set stock_quantity = stock_quantity + 1
        where id = v_schedule_id and stock_quantity is not null;
      end if;
    end if;
  end if;
end $$;

revoke all on function public.delete_pet_fluid_therapy(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_pet_fluid_therapy(uuid, uuid, integer) to authenticated, service_role;
