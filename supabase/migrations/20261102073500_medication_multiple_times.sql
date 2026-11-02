-- ==============================================================================
-- Migracja: medication_multiple_times
-- Dodanie obsługi podawania leku kilka razy dziennie (scheduled_times text[])
-- ==============================================================================

-- 1. Dodanie kolumny scheduled_times (tablica godzin w formacie HH:MM)
alter table public.medication_schedules
  add column if not exists scheduled_times text[] not null default '{}';

-- 2. Wypełnienie scheduled_times z istniejącego scheduled_time dla istniejących rekordów
update public.medication_schedules
set scheduled_times = array[scheduled_time]
where scheduled_time <> ''
  and (scheduled_times is null or cardinality(scheduled_times) = 0);

-- 3. Aktualizacja funkcji RPC save_medication_schedule z opcjonalnym parametrem p_scheduled_times
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
  p_scheduled_times text[] default '{}'
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
        is_active = p_is_active
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[]) from public, anon;
grant execute on function public.save_medication_schedule(uuid, uuid, integer, text, text, text, integer, text, date, date, text, text, boolean, text[]) to authenticated;
