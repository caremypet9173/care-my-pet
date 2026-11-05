-- Migracja: Usunięcie ograniczenia unikalności source_path z wynik_badania
-- oraz funkcja RPC do wsadowego importu wielostronicowych wypisów z lecznicy.

-- 1. Zezwolenie wielu rekordom wynik_badania na wskazywanie tego samego pliku źródłowego (np. wypis wielostronicowy)
alter table public.wynik_badania drop constraint if exists wynik_badania_source_path_key;
create index if not exists wynik_source_path_idx on public.wynik_badania(source_path);

-- 2. Funkcja do atomowego, wsadowego importu wypisu z lecznicy
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
  v_row jsonb;
  v_ev jsonb;
  v_wt jsonb;
  v_rep_id uuid;
  v_rep_count int := 0;
  v_ev_count int := 0;
  v_wt_count int := 0;
  v_ordinal int := 0;
  v_category text;
  v_event_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict v_home_id from public.zwierze where id = p_pet_id;

  -- 1. Badania laboratoryjne i obrazowe (wynik_badania + pomiar_parametru)
  if jsonb_typeof(p_data->'lab_reports') = 'array' then
    for v_rep in select value from jsonb_array_elements(p_data->'lab_reports') loop
      v_rep_id := coalesce((v_rep->>'id')::uuid, gen_random_uuid());
      v_event_date := (v_rep->>'date')::date;
      
      insert into public.wynik_badania(
        id, gospodarstwo_id, zwierze_id, title, test_date, laboratory, doctor, notes,
        ai_interpretation, source_path, source_name, source_mime, created_by, source_sha256
      ) values (
        v_rep_id,
        v_home_id,
        p_pet_id,
        coalesce(nullif(btrim(v_rep->>'title'), ''), 'Badanie laboratoryjne'),
        v_event_date,
        coalesce(v_rep->>'laboratory', ''),
        coalesce(v_rep->>'doctor', ''),
        coalesce(v_rep->>'notes', ''),
        coalesce(v_rep->>'ai_interpretation', ''),
        p_source_path,
        p_source_name,
        p_source_mime,
        auth.uid(),
        p_source_sha256
      );

      v_ordinal := 0;
      if jsonb_typeof(v_rep->'parameters') = 'array' then
        for v_row in select value from jsonb_array_elements(v_rep->'parameters') loop
          v_ordinal := v_ordinal + 1;
          v_category := coalesce(v_row->>'category', 'other');
          if v_category not in ('blood', 'renal', 'liver', 'other') then
            v_category := 'other';
          end if;

          insert into public.pomiar_parametru(
            wynik_id, gospodarstwo_id, ordinal, name, value, unit, reference, category
          ) values (
            v_rep_id,
            v_home_id,
            v_ordinal,
            coalesce(nullif(btrim(v_row->>'name'), ''), 'Parametr'),
            coalesce(nullif(btrim(v_row->>'value'), ''), '-'),
            coalesce(v_row->>'unit', ''),
            coalesce(v_row->>'reference', ''),
            v_category
          );
        end loop;
      end if;

      v_rep_count := v_rep_count + 1;
    end loop;
  end if;

  -- 2. Wizyty kliniczne, zabiegi i konsultacje (pet_health_event)
  if jsonb_typeof(p_data->'clinical_events') = 'array' then
    for v_ev in select value from jsonb_array_elements(p_data->'clinical_events') loop
      v_category := coalesce(v_ev->>'category', 'visit');
      if v_category not in ('visit', 'vaccination', 'prevention') then
        v_category := 'visit';
      end if;

      insert into public.pet_health_event(
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
        auth.uid()
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
        auth.uid()
      );
      v_wt_count := v_wt_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'reports_count', v_rep_count,
    'events_count', v_ev_count,
    'weights_count', v_wt_count
  );
end $$;

revoke all on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) to authenticated;
