-- Dodanie kolumny ai_interpretation do tabeli wynik_badania
alter table public.wynik_badania
  add column if not exists ai_interpretation text not null default ''
  check (char_length(ai_interpretation) <= 12000);

-- Aktualizacja funkcji confirm_medical_report obsługującej pole ai_interpretation w p_report
create or replace function public.confirm_medical_report(
  p_id uuid,
  p_pet_id uuid,
  p_source_path text,
  p_source_name text,
  p_source_mime text,
  p_report jsonb,
  p_source_sha256 text
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  home_id uuid;
  row jsonb;
  i integer := 0;
  existing public.wynik_badania;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  -- Serialize retries of the same confirmation, including a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into existing from public.wynik_badania where id = p_id;
  if found then
    if existing.created_by = auth.uid()
      and existing.zwierze_id = p_pet_id
      and existing.source_path = p_source_path
      and existing.title = p_report->>'title'
      and existing.test_date = (p_report->>'test_date')::date
      and existing.laboratory = coalesce(p_report->>'laboratory', '')
      and existing.doctor = coalesce(p_report->>'doctor', '')
      and existing.notes = coalesce(p_report->>'notes', '')
      and existing.ai_interpretation = coalesce(p_report->>'ai_interpretation', '')
      and existing.source_name = p_source_name
      and existing.source_mime = p_source_mime
      and coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'name', m.name,
            'value', m.value,
            'unit', m.unit,
            'reference', m.reference,
            'category', m.category
          ) order by m.ordinal
        ) from public.pomiar_parametru m where m.wynik_id = p_id),
        '[]'::jsonb
      ) = p_report->'rows'
    then
      return p_id;
    end if;
    raise exception 'Conflicting report id' using errcode='23505';
  end if;

  if p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid hash' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_pet_id::text || p_source_sha256, 3));
  if exists(select 1 from public.wynik_badania where zwierze_id = p_pet_id and source_sha256 = p_source_sha256) then
    raise exception 'Duplicate document' using errcode='PT409';
  end if;

  select gospodarstwo_id into strict home_id from public.zwierze where id = p_pet_id;
  if jsonb_typeof(p_report->'rows') is distinct from 'array' or jsonb_array_length(p_report->'rows') > 100 then
    raise exception 'Invalid measurements' using errcode='22023';
  end if;

  insert into public.wynik_badania(
    id, gospodarstwo_id, zwierze_id, title, test_date, laboratory, doctor, notes,
    source_path, source_name, source_mime, created_by, source_sha256, ai_interpretation
  ) values (
    p_id, home_id, p_pet_id,
    p_report->>'title',
    (p_report->>'test_date')::date,
    coalesce(p_report->>'laboratory', ''),
    coalesce(p_report->>'doctor', ''),
    coalesce(p_report->>'notes', ''),
    p_source_path, p_source_name, p_source_mime,
    auth.uid(),
    p_source_sha256,
    coalesce(p_report->>'ai_interpretation', '')
  );

  for row in select value from jsonb_array_elements(p_report->'rows') loop
    i := i + 1;
    insert into public.pomiar_parametru(
      wynik_id, gospodarstwo_id, ordinal, name, value, unit, reference, category
    ) values (
      p_id, home_id, i,
      row->>'name',
      row->>'value',
      coalesce(row->>'unit', ''),
      coalesce(row->>'reference', ''),
      row->>'category'
    );
  end loop;

  return p_id;
end $$;

revoke all on function public.confirm_medical_report(uuid, uuid, text, text, text, jsonb, text) from public, anon;
grant execute on function public.confirm_medical_report(uuid, uuid, text, text, text, jsonb, text) to authenticated;
