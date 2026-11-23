-- =============================================================================
-- Migracja: Naprawa ON CONFLICT w record_medication_dose oraz indeksu unikalnego
-- =============================================================================

-- 1. Zastąpienie częściowego indeksu pełnym indeksem unikalnym
drop index if exists public.medication_logs_schedule_dose_unique_idx;

create unique index medication_logs_schedule_dose_unique_idx
  on public.medication_logs (schedule_id, dose_date, scheduled_time);

-- 2. Aktualizacja procedury record_medication_dose z obsługą coalesce i poprawnego ON CONFLICT
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
  clean_time text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  clean_time := coalesce(p_scheduled_time, '');

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
      clean_time,
      now(),
      coalesce(p_status, 'taken'),
      auth.uid(),
      coalesce(p_notes, ''),
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
      clean_time,
      now(),
      coalesce(p_status, 'taken'),
      auth.uid(),
      coalesce(p_notes, ''),
      auth.uid()
    ) returning * into result;
  end if;

  return result;
end $$;

revoke all on function public.record_medication_dose(uuid, uuid, date, text, text, text) from public, anon;
grant execute on function public.record_medication_dose(uuid, uuid, date, text, text, text) to authenticated, service_role;
