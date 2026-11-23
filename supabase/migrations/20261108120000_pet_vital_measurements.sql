-- ==============================================================================
-- Migracja: pet_vital_measurements
-- Obsługa pomiarów parametrów życiowych pupila (ciśnienie tętnicze krwi, glukoza, temperatura)
-- ==============================================================================

-- 1. Utworzenie tabeli public.pet_vital_measurement
create table public.pet_vital_measurement (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  metric_type text not null check(metric_type in ('blood_pressure', 'glucose', 'temperature')),
  value_primary numeric(8,2) not null check(value_primary > 0),
  value_secondary numeric(8,2) check(value_secondary is null or value_secondary > 0),
  value_tertiary numeric(8,2) check(value_tertiary is null or value_tertiary > 0),
  unit text not null check(unit in ('mmHg', 'mg/dL', '°C')),
  context text not null default '' check(char_length(context) <= 100),
  measured_at timestamptz not null default now(),
  measured_on date not null check(measured_on >= date '1900-01-01' and measured_on <= (now() at time zone 'Europe/Warsaw')::date),
  note text not null default '' check(char_length(note) <= 300),
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeksy pod szybkie filtrowanie i sortowanie chronologiczne
create index pet_vital_pet_type_date on public.pet_vital_measurement(pet_id, metric_type, measured_on desc, created_at desc);
create index pet_vital_household on public.pet_vital_measurement(household_id);

-- 2. Jawne nadanie uprawnień API (wymagane od 30.10.2026 przed RLS)
grant select on public.pet_vital_measurement to anon;
grant select, insert, update, delete on public.pet_vital_measurement to authenticated;
grant select, insert, update, delete on public.pet_vital_measurement to service_role;

-- 3. Row Level Security
alter table public.pet_vital_measurement enable row level security;

create policy vital_measurement_read on public.pet_vital_measurement
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

create policy vital_measurement_insert on public.pet_vital_measurement
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

create policy vital_measurement_update on public.pet_vital_measurement
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

create policy vital_measurement_delete on public.pet_vital_measurement
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- 4. Trigger integralności i wersjonowania
create function public.validate_pet_vital_measurement()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch or invalid household' using errcode = '42501';
  end if;

  -- Spójność jednostki z typem pomiaru
  if new.metric_type = 'blood_pressure' and new.unit <> 'mmHg' then
    raise exception 'Blood pressure unit must be mmHg' using errcode = '22023';
  elsif new.metric_type = 'glucose' and new.unit <> 'mg/dL' then
    raise exception 'Glucose unit must be mg/dL' using errcode = '22023';
  elsif new.metric_type = 'temperature' and new.unit <> '°C' then
    raise exception 'Temperature unit must be °C' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' then
    if (new.id, new.pet_id, new.household_id, new.metric_type, new.unit, new.created_by, new.created_at) is distinct from
       (old.id, old.pet_id, old.household_id, old.metric_type, old.unit, old.created_by, old.created_at) then
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

revoke all on function public.validate_pet_vital_measurement() from public, anon, authenticated;

create trigger vital_measurement_validate
  before insert or update on public.pet_vital_measurement
  for each row execute function public.validate_pet_vital_measurement();

-- 5. Funkcja RPC: save_pet_vital_measurement
create function public.save_pet_vital_measurement(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_metric_type text,
  p_value_primary numeric,
  p_value_secondary numeric,
  p_value_tertiary numeric,
  p_unit text,
  p_context text,
  p_measured_at timestamptz,
  p_measured_on date,
  p_note text
)
returns public.pet_vital_measurement language plpgsql security invoker set search_path='' as $$
declare
  result public.pet_vital_measurement;
  home uuid;
  effective_measured_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict home from public.zwierze where id = p_pet_id;

  if p_metric_type not in ('blood_pressure', 'glucose', 'temperature') then
    raise exception 'Unsupported metric type' using errcode = '22023';
  end if;

  if p_value_primary <= 0 or (p_value_secondary is not null and p_value_secondary <= 0) or (p_value_tertiary is not null and p_value_tertiary <= 0) then
    raise exception 'Measurement values must be positive' using errcode = '22023';
  end if;

  effective_measured_at := coalesce(p_measured_at, (p_measured_on::text || ' 12:00:00')::timestamptz, now());

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 2));

  select * into result from public.pet_vital_measurement where id = p_id;

  if p_revision = 0 then
    if found then
      if result.pet_id = p_pet_id
        and result.metric_type = p_metric_type
        and result.value_primary = p_value_primary
        and coalesce(result.value_secondary, 0) = coalesce(p_value_secondary, 0)
        and coalesce(result.value_tertiary, 0) = coalesce(p_value_tertiary, 0)
        and result.unit = p_unit
        and result.measured_on = p_measured_on
        and result.revision = 1 then
        return result;
      end if;
      raise exception 'Conflicting entry' using errcode = 'PT409';
    end if;

    insert into public.pet_vital_measurement (
      id,
      pet_id,
      household_id,
      metric_type,
      value_primary,
      value_secondary,
      value_tertiary,
      unit,
      context,
      measured_at,
      measured_on,
      note,
      created_by
    ) values (
      p_id,
      p_pet_id,
      home,
      p_metric_type,
      round(p_value_primary, 2),
      round(p_value_secondary, 2),
      round(p_value_tertiary, 2),
      p_unit,
      coalesce(p_context, ''),
      effective_measured_at,
      p_measured_on,
      coalesce(p_note, ''),
      (select auth.uid())
    ) returning * into result;
  else
    update public.pet_vital_measurement
    set value_primary = round(p_value_primary, 2),
        value_secondary = round(p_value_secondary, 2),
        value_tertiary = round(p_value_tertiary, 2),
        context = coalesce(p_context, ''),
        measured_at = effective_measured_at,
        measured_on = p_measured_on,
        note = coalesce(p_note, '')
    where id = p_id and pet_id = p_pet_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_pet_vital_measurement(uuid, uuid, integer, text, numeric, numeric, numeric, text, text, timestamptz, date, text) from public, anon;
grant execute on function public.save_pet_vital_measurement(uuid, uuid, integer, text, numeric, numeric, numeric, text, text, timestamptz, date, text) to authenticated;

-- 6. Funkcja RPC: delete_pet_vital_measurement
create function public.delete_pet_vital_measurement(
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

  delete from public.pet_vital_measurement
  where id = p_id and pet_id = p_pet_id and revision = p_revision;

  if not found then
    raise exception 'Entry changed or unavailable' using errcode = 'PT409';
  end if;
end $$;

revoke all on function public.delete_pet_vital_measurement(uuid, uuid, integer) from public, anon;
grant execute on function public.delete_pet_vital_measurement(uuid, uuid, integer) to authenticated;

-- 7. Aktualizacja import_clinical_discharge_batch z obsługą pomiarów parametrów życiowych
create or replace function public.import_clinical_discharge_batch(
  p_pet_id uuid,
  p_source_path text,
  p_source_name text,
  p_source_mime text,
  p_source_sha256 text,
  p_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_home_id uuid;
  v_rep jsonb;
  v_ev jsonb;
  v_wt jsonb;
  v_vt jsonb;
  v_param jsonb;
  v_rep_id uuid;
  v_rep_count integer := 0;
  v_ev_count integer := 0;
  v_wt_count integer := 0;
  v_vt_count integer := 0;
  v_category text;
  v_metric_type text;
  v_unit text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict v_home_id
  from public.zwierze
  where id = p_pet_id;

  -- 1. Badania laboratoryjne i USG
  if jsonb_typeof(p_data->'lab_reports') = 'array' then
    for v_rep in select value from jsonb_array_elements(p_data->'lab_reports') loop
      v_rep_id := coalesce((v_rep->>'id')::uuid, gen_random_uuid());
      
      insert into public.wynik_badania (
        id,
        pet_id,
        gospodarstwo_id,
        title,
        test_date,
        laboratory,
        doctor,
        notes,
        ai_interpretation,
        source_path,
        source_name,
        source_mime,
        source_sha256,
        created_by
      ) values (
        v_rep_id,
        p_pet_id,
        v_home_id,
        coalesce(nullif(btrim(v_rep->>'title'), ''), 'Badanie diagnostyczne'),
        (v_rep->>'date')::date,
        coalesce(v_rep->>'laboratory', ''),
        coalesce(v_rep->>'doctor', ''),
        coalesce(v_rep->>'notes', ''),
        coalesce(v_rep->>'ai_interpretation', ''),
        p_source_path,
        p_source_name,
        p_source_mime,
        p_source_sha256,
        (select auth.uid())
      );

      if jsonb_typeof(v_rep->'parameters') = 'array' then
        for v_param in select value from jsonb_array_elements(v_rep->'parameters') loop
          insert into public.pomiar_parametru (
            wynik_id,
            gospodarstwo_id,
            name,
            value,
            unit,
            reference_range,
            is_key,
            status,
            category
          ) values (
            v_rep_id,
            v_home_id,
            coalesce(nullif(btrim(v_param->>'name'), ''), 'Parametr'),
            coalesce(nullif(btrim(v_param->>'value'), ''), '-'),
            coalesce(v_param->>'unit', ''),
            coalesce(v_param->>'reference', ''),
            coalesce((v_param->>'is_key')::boolean, false),
            case 
              when v_param->>'status' in ('normal', 'low', 'high', 'critical', 'unverified') then v_param->>'status'
              else 'unverified'
            end,
            case 
              when v_param->>'category' in ('hematology', 'biochemistry', 'electrolytes', 'urinalysis', 'hormones', 'other') then v_param->>'category'
              else 'other'
            end
          );
        end loop;
      end if;

      v_rep_count := v_rep_count + 1;
    end loop;
  end if;

  -- 2. Wizyty kliniczne (pet_health_event)
  if jsonb_typeof(p_data->'clinical_events') = 'array' then
    for v_ev in select value from jsonb_array_elements(p_data->'clinical_events') loop
      v_category := coalesce(v_ev->>'category', 'visit');
      if v_category not in ('visit', 'treatment', 'vaccination', 'prevention') then
        v_category := 'visit';
      end if;

      insert into public.pet_health_event (
        id,
        pet_id,
        household_id,
        category,
        title,
        event_date,
        next_due_date,
        clinic,
        doctor,
        batch_or_product,
        description,
        source_path,
        source_name,
        source_mime,
        created_by
      ) values (
        coalesce((v_ev->>'id')::uuid, gen_random_uuid()),
        p_pet_id,
        v_home_id,
        v_category,
        coalesce(nullif(btrim(v_ev->>'title'), ''), 'Wizyta w lecznicy'),
        (v_ev->>'date')::date,
        nullif(v_ev->>'next_due_date', '')::date,
        coalesce(v_ev->>'clinic', ''),
        coalesce(v_ev->>'doctor', ''),
        coalesce(v_ev->>'batch_or_product', ''),
        coalesce(v_ev->>'description', ''),
        p_source_path,
        p_source_name,
        p_source_mime,
        (select auth.uid())
      );
      v_ev_count := v_ev_count + 1;
    end loop;
  end if;

  -- 3. Pomiary wagi (pet_weight)
  if jsonb_typeof(p_data->'weights') = 'array' then
    for v_wt in select value from jsonb_array_elements(p_data->'weights') loop
      insert into public.pet_weight(
        id,
        pet_id,
        household_id,
        kg,
        measured_on,
        note,
        created_by
      ) values (
        coalesce((v_wt->>'id')::uuid, gen_random_uuid()),
        p_pet_id,
        v_home_id,
        (v_wt->>'value')::numeric,
        (v_wt->>'date')::date,
        coalesce(nullif(btrim(v_wt->>'note'), ''), 'Wypis z lecznicy'),
        (select auth.uid())
      );
      v_wt_count := v_wt_count + 1;
    end loop;
  end if;

  -- 4. Pomiary parametrów życiowych (pet_vital_measurement: blood_pressure, temperature, glucose)
  if jsonb_typeof(p_data->'vitals') = 'array' then
    for v_vt in select value from jsonb_array_elements(p_data->'vitals') loop
      v_metric_type := coalesce(v_vt->>'metric_type', 'temperature');
      if v_metric_type in ('blood_pressure', 'glucose', 'temperature') then
        v_unit := case
          when v_metric_type = 'blood_pressure' then 'mmHg'
          when v_metric_type = 'glucose' then 'mg/dL'
          else '°C'
        end;

        insert into public.pet_vital_measurement (
          id,
          pet_id,
          household_id,
          metric_type,
          value_primary,
          value_secondary,
          value_tertiary,
          unit,
          context,
          measured_at,
          measured_on,
          note,
          created_by
        ) values (
          coalesce((v_vt->>'id')::uuid, gen_random_uuid()),
          p_pet_id,
          v_home_id,
          v_metric_type,
          (v_vt->>'value_primary')::numeric,
          nullif(v_vt->>'value_secondary', '')::numeric,
          nullif(v_vt->>'value_tertiary', '')::numeric,
          v_unit,
          coalesce(v_vt->>'context', 'Wypis z lecznicy'),
          coalesce((v_vt->>'measured_at')::timestamptz, ((v_vt->>'date') || ' 12:00:00')::timestamptz, now()),
          (v_vt->>'date')::date,
          coalesce(nullif(btrim(v_vt->>'note'), ''), 'Wypis z lecznicy'),
          (select auth.uid())
        );
        v_vt_count := v_vt_count + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'reports_count', v_rep_count,
    'events_count', v_ev_count,
    'weights_count', v_wt_count,
    'vitals_count', v_vt_count
  );
end $$;

revoke all on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) to authenticated;
