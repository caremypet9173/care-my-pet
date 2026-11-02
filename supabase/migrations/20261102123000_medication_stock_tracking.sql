-- ==============================================================================
-- Migracja: medication_stock_tracking
-- Rozszerzenie harmonogramów leków o kontrolę zapasów w apteczce (Care My Pet)
-- Obsługa:
-- 1. stock_quantity (liczba pozostałych dawek/tabletek)
-- 2. low_stock_threshold (próg ostrzeżenia o niskim stanie)
-- 3. stock_unit (jednostka np. dawek, tabletek, kapsułek, ml)
-- 4. Automatyczna dekrementacja zapasu przy zatwierdzeniu podania dawki (status = 'taken')
-- 5. Automatyczna inkrementacja przy cofnięciu podania dawki
-- ==============================================================================

-- 1. Dodanie kolumn zapasu do tabeli medication_schedules
alter table public.medication_schedules
  add column if not exists stock_quantity numeric check (stock_quantity is null or stock_quantity >= 0),
  add column if not exists low_stock_threshold numeric default 5 check (low_stock_threshold is null or low_stock_threshold >= 0),
  add column if not exists stock_unit text not null default 'dawek' check (char_length(stock_unit) <= 30);

-- 2. Aktualizacja funkcji RPC save_medication_schedule z obsługą stanu magazynowego
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
  p_is_active boolean default true,
  p_scheduled_times text[] default '{}',
  p_stock_quantity numeric default null,
  p_low_stock_threshold numeric default 5,
  p_stock_unit text default 'dawek'
) returns public.medication_schedules language plpgsql security invoker set search_path = '' as $$
declare
  result public.medication_schedules;
  home uuid;
  v_times text[];
  v_main_time text;
begin
  if auth.uid() is null then
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
      coalesce(nullif(trim(p_stock_unit), ''), 'dawek'),
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
        scheduled_time = v_main_time,
        scheduled_times = v_times,
        instructions = p_instructions,
        is_active = p_is_active,
        stock_quantity = p_stock_quantity,
        low_stock_threshold = coalesce(p_low_stock_threshold, 5),
        stock_unit = coalesce(nullif(trim(p_stock_unit), ''), 'dawek')
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

-- Jawne uprawnienia dla funkcji
revoke all on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[], numeric, numeric, text) from public, anon;
grant execute on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[], numeric, numeric, text) to authenticated;

-- 3. Aktualizacja funkcji RPC record_medication_dose o dekrementację zapasu
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  if p_schedule_id is not null then
    -- Sprawdź poprzedni status dla tej dawki (jeśli istniał)
    select status into prev_status
    from public.medication_logs
    where schedule_id = p_schedule_id
      and dose_date = p_dose_date
      and scheduled_time = p_scheduled_time;

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

-- 4. Aktualizacja funkcji RPC delete_medication_dose_log o przywrócenie zapasu
create or replace function public.delete_medication_dose_log(
  p_log_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_schedule_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select schedule_id, status into v_schedule_id, v_status
  from public.medication_logs
  where id = p_log_id
    and household_id in (select id from public.gospodarstwo);

  if not found then
    raise exception 'Entry not found or access denied' using errcode = 'PT404';
  end if;

  delete from public.medication_logs where id = p_log_id;

  -- Jeśli usuwamy zatwierdzone podanie dawki, zwróć 1 do zapasu leku
  if v_status = 'taken' and v_schedule_id is not null then
    update public.medication_schedules
    set stock_quantity = stock_quantity + 1
    where id = v_schedule_id and stock_quantity is not null;
  end if;
end $$;
