-- ============================================================================
-- Migracja #61: Kosz (soft-delete 30d), przenoszenie badań między pupilami,
-- re-użycie po SHA-256 w gospodarstwie, licznik limitu AI oraz 24h cache
-- odrzuconych dokumentów niemedycznych.
-- ============================================================================

-- 1. Kolumny soft-delete na public.wynik_badania
alter table public.wynik_badania
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.wynik_badania'::regclass
      and conname = 'wynik_badania_deleted_state_check'
  ) then
    alter table public.wynik_badania
      add constraint wynik_badania_deleted_state_check
      check ((deleted_at is null and deleted_by is null) or deleted_at is not null);
  end if;
end $$;

create index if not exists wynik_household_hash_idx
  on public.wynik_badania (gospodarstwo_id, source_sha256)
  where source_sha256 is not null;

create index if not exists wynik_pet_deleted_idx
  on public.wynik_badania (zwierze_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists wynik_deleted_purge_idx
  on public.wynik_badania (deleted_at)
  where deleted_at is not null;

-- 2. Prywatny 24h cache odrzuconych hashy plików niemedycznych (bez treści pliku / bez PII)
create table if not exists private.rejected_document_hash (
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  document_type text not null check (document_type in ('non_medical', 'unreadable')),
  rejection_reason text not null default '' check (char_length(rejection_reason) <= 300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (household_id, source_sha256)
);

create index if not exists rejected_document_hash_expires_idx
  on private.rejected_document_hash (expires_at);

alter table private.rejected_document_hash enable row level security;
revoke all on private.rejected_document_hash from public, anon, authenticated;
grant select, insert, update, delete on private.rejected_document_hash to service_role;

-- 3. Rozszerzenie dozwolonych statusów w private.ai_usage_log o 'rejected_non_medical'
do $$
declare
  v_conname text;
begin
  for v_conname in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'private.ai_usage_log'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table private.ai_usage_log drop constraint %I', v_conname);
  end loop;
end $$;

alter table private.ai_usage_log
  add constraint ai_usage_log_status_check
  check (status in ('ok', 'http_error', 'invalid_output', 'timeout', 'rejected_non_medical'));

create or replace function private.log_ai_usage(
  p_pet_id uuid,
  p_feature text,
  p_model text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_prompt_tokens integer,
  p_output_tokens integer,
  p_thoughts_tokens integer,
  p_total_tokens integer,
  p_duration_ms integer,
  p_status text,
  p_http_status integer default 200,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_household_id uuid;
  v_cost numeric(12, 6);
  v_status text := case
    when p_status in ('ok', 'http_error', 'invalid_output', 'timeout', 'rejected_non_medical') then p_status
    else 'http_error'
  end;
begin
  if v_user_id is null then
    return;
  end if;

  select z.gospodarstwo_id into v_household_id
  from public.zwierze z
  where z.id = p_pet_id
    and z.gospodarstwo_id in (
      select g.id from public.gospodarstwo g
      where g.owner_id = v_user_id
         or exists (
           select 1 from public.czlonek_gospodarstwa c
           where c.gospodarstwo_id = g.id and c.user_id = v_user_id
         )
    );

  v_cost := private.calculate_gemini_cost_usd(
    p_model,
    coalesce(p_prompt_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_thoughts_tokens, 0)
  );

  insert into private.ai_usage_log (
    user_id,
    household_id,
    pet_id,
    feature,
    model,
    mime_type,
    file_size_bytes,
    prompt_tokens,
    output_tokens,
    thoughts_tokens,
    total_tokens,
    estimated_cost_usd,
    duration_ms,
    status,
    http_status
  ) values (
    v_user_id,
    v_household_id,
    p_pet_id,
    p_feature,
    left(coalesce(p_model, 'unknown'), 80),
    left(coalesce(p_mime_type, 'application/octet-stream'), 60),
    greatest(coalesce(p_file_size_bytes, 0), 0),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    greatest(coalesce(p_thoughts_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0),
    v_cost,
    greatest(coalesce(p_duration_ms, 0), 0),
    v_status,
    p_http_status
  );
end;
$$;

revoke all on function private.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer, uuid) from public, anon, authenticated;
grant execute on function private.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer, uuid) to service_role;

-- 4. Odczyt statusu dziennego limitu odczytów AI dla UI (bez inkrementacji)
create or replace function private.get_medical_read_quota_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := 10;
  v_used integer := 0;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    return jsonb_build_object('used', 0, 'limit', v_limit, 'remaining', 0);
  end if;

  select q.used
  into v_used
  from private.medical_read_quota q
  where q.user_id = v_uid
    and q.day = (now() at time zone 'UTC')::date;

  v_used := coalesce(v_used, 0);
  return jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0)
  );
end;
$$;

revoke all on function private.get_medical_read_quota_status() from public, anon;
grant execute on function private.get_medical_read_quota_status() to authenticated, service_role;

create or replace function public.get_medical_read_quota_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_medical_read_quota_status();
$$;

revoke all on function public.get_medical_read_quota_status() from public, anon;
grant execute on function public.get_medical_read_quota_status() to authenticated, service_role;

-- 5. Aktualizacja confirm_medical_report: duplikat tylko wśród aktywnych (deleted_at is null)
create or replace function public.confirm_medical_report(
  p_id uuid,
  p_pet_id uuid,
  p_source_path text,
  p_source_name text,
  p_source_mime text,
  p_report jsonb,
  p_source_sha256 text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  home_id uuid;
  row jsonb;
  i integer := 0;
  existing public.wynik_badania;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize retries of the same confirmation, including a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into existing from public.wynik_badania where id = p_id;
  if found then
    if existing.deleted_at is null
      and existing.created_by = auth.uid()
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
    raise exception 'Conflicting report id' using errcode = '23505';
  end if;

  if p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_pet_id::text || p_source_sha256, 3));
  if exists(
    select 1
    from public.wynik_badania
    where zwierze_id = p_pet_id
      and source_sha256 = p_source_sha256
      and deleted_at is null
  ) then
    raise exception 'Duplicate document' using errcode = 'PT409';
  end if;

  select gospodarstwo_id into strict home_id from public.zwierze where id = p_pet_id;
  if jsonb_typeof(p_report->'rows') is distinct from 'array' or jsonb_array_length(p_report->'rows') > 100 then
    raise exception 'Invalid measurements' using errcode = '22023';
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
end;
$$;

revoke all on function public.confirm_medical_report(uuid, uuid, text, text, text, jsonb, text) from public, anon;
grant execute on function public.confirm_medical_report(uuid, uuid, text, text, text, jsonb, text) to authenticated;

-- 6. Kontrolowane RPC: soft-delete (Kosz), przywracanie, trwałe usunięcie i przeniesienie
create or replace function public.soft_delete_medical_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.wynik_badania%rowtype;
  v_pet_archived timestamptz;
  v_now timestamptz := now();
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_report
  from public.wynik_badania
  where id = p_report_id
  for update;

  if not found or not (v_report.gospodarstwo_id in (select public.get_user_household_ids())) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if not public.household_has_recovery_key(v_report.gospodarstwo_id) then
    raise exception 'Household recovery key required' using errcode = 'PT428';
  end if;

  select z.archived_at into v_pet_archived
  from public.zwierze z
  where z.id = v_report.zwierze_id;

  if v_pet_archived is not null then
    raise exception 'Pet record is archived' using errcode = 'PT423';
  end if;

  if v_report.deleted_at is not null then
    return jsonb_build_object(
      'id', v_report.id,
      'pet_id', v_report.zwierze_id,
      'deleted_at', v_report.deleted_at,
      'already_deleted', true
    );
  end if;

  update public.wynik_badania
  set deleted_at = v_now,
      deleted_by = v_uid
  where id = p_report_id;

  delete from public.pet_knowledge_chunk
  where source_type = 'medical_report'
    and source_id = p_report_id;

  return jsonb_build_object(
    'id', v_report.id,
    'pet_id', v_report.zwierze_id,
    'deleted_at', v_now,
    'already_deleted', false
  );
end;
$$;

revoke all on function public.soft_delete_medical_report(uuid) from public, anon;
grant execute on function public.soft_delete_medical_report(uuid) to authenticated, service_role;

create or replace function public.restore_medical_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.wynik_badania%rowtype;
  v_pet_archived timestamptz;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_report
  from public.wynik_badania
  where id = p_report_id
  for update;

  if not found or not (v_report.gospodarstwo_id in (select public.get_user_household_ids())) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if not public.household_has_recovery_key(v_report.gospodarstwo_id) then
    raise exception 'Household recovery key required' using errcode = 'PT428';
  end if;

  select z.archived_at into v_pet_archived
  from public.zwierze z
  where z.id = v_report.zwierze_id;

  if v_pet_archived is not null then
    raise exception 'Pet record is archived' using errcode = 'PT423';
  end if;

  if v_report.deleted_at is null then
    return jsonb_build_object(
      'id', v_report.id,
      'pet_id', v_report.zwierze_id,
      'already_active', true
    );
  end if;

  if v_report.source_sha256 is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_report.zwierze_id::text || v_report.source_sha256, 3));
    if exists (
      select 1
      from public.wynik_badania w
      where w.zwierze_id = v_report.zwierze_id
        and w.source_sha256 = v_report.source_sha256
        and w.deleted_at is null
        and w.id <> p_report_id
    ) then
      raise exception 'Duplicate document' using errcode = 'PT409';
    end if;
  end if;

  update public.wynik_badania
  set deleted_at = null,
      deleted_by = null
  where id = p_report_id;

  return jsonb_build_object(
    'id', v_report.id,
    'pet_id', v_report.zwierze_id,
    'already_active', false
  );
end;
$$;

revoke all on function public.restore_medical_report(uuid) from public, anon;
grant execute on function public.restore_medical_report(uuid) to authenticated, service_role;

create or replace function public.delete_medical_report_permanently(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.wynik_badania%rowtype;
  v_pet_archived timestamptz;
  v_still_referenced boolean := false;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_report
  from public.wynik_badania
  where id = p_report_id
  for update;

  if not found or not (v_report.gospodarstwo_id in (select public.get_user_household_ids())) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if not public.household_has_recovery_key(v_report.gospodarstwo_id) then
    raise exception 'Household recovery key required' using errcode = 'PT428';
  end if;

  select z.archived_at into v_pet_archived
  from public.zwierze z
  where z.id = v_report.zwierze_id;

  if v_pet_archived is not null then
    raise exception 'Pet record is archived' using errcode = 'PT423';
  end if;

  if v_report.deleted_at is null then
    raise exception 'Move report to trash before permanent deletion' using errcode = '22023';
  end if;

  delete from public.wynik_badania
  where id = p_report_id;

  v_still_referenced := exists (
    select 1 from public.wynik_badania r where r.source_path = v_report.source_path
  ) or exists (
    select 1 from public.pet_health_event e where e.source_path = v_report.source_path
  );

  return jsonb_build_object(
    'id', v_report.id,
    'pet_id', v_report.zwierze_id,
    'source_path', v_report.source_path,
    'storage_can_delete', not v_still_referenced
  );
end;
$$;

revoke all on function public.delete_medical_report_permanently(uuid) from public, anon;
grant execute on function public.delete_medical_report_permanently(uuid) to authenticated, service_role;

create or replace function public.move_medical_report(
  p_report_id uuid,
  p_target_pet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.wynik_badania%rowtype;
  v_source_pet_archived timestamptz;
  v_target_pet public.zwierze%rowtype;
  v_was_trashed boolean := false;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_report
  from public.wynik_badania
  where id = p_report_id
  for update;

  if not found or not (v_report.gospodarstwo_id in (select public.get_user_household_ids())) then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if v_report.zwierze_id = p_target_pet_id then
    raise exception 'Target pet matches current pet' using errcode = '22023';
  end if;

  if not public.household_has_recovery_key(v_report.gospodarstwo_id) then
    raise exception 'Household recovery key required' using errcode = 'PT428';
  end if;

  select z.archived_at into v_source_pet_archived
  from public.zwierze z
  where z.id = v_report.zwierze_id;

  if v_source_pet_archived is not null then
    raise exception 'Source pet record is archived' using errcode = 'PT423';
  end if;

  select z.* into v_target_pet
  from public.zwierze z
  where z.id = p_target_pet_id
    and z.gospodarstwo_id = v_report.gospodarstwo_id;

  if not found then
    raise exception 'Target pet not found in household' using errcode = 'P0002';
  end if;

  if v_target_pet.archived_at is not null then
    raise exception 'Target pet record is archived' using errcode = 'PT423';
  end if;

  if v_report.source_sha256 is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_target_pet_id::text || v_report.source_sha256, 3));
    if exists (
      select 1
      from public.wynik_badania w
      where w.zwierze_id = p_target_pet_id
        and w.source_sha256 = v_report.source_sha256
        and w.deleted_at is null
        and w.id <> p_report_id
    ) then
      raise exception 'Duplicate document' using errcode = 'PT409';
    end if;
  end if;

  v_was_trashed := (v_report.deleted_at is not null);

  update public.wynik_badania
  set zwierze_id = p_target_pet_id,
      deleted_at = null,
      deleted_by = null
  where id = p_report_id;

  update public.pet_knowledge_chunk
  set pet_id = p_target_pet_id
  where source_type = 'medical_report'
    and source_id = p_report_id;

  return jsonb_build_object(
    'id', v_report.id,
    'from_pet_id', v_report.zwierze_id,
    'target_pet_id', p_target_pet_id,
    'target_pet_name', v_target_pet.imie,
    'was_trashed', v_was_trashed
  );
end;
$$;

revoke all on function public.move_medical_report(uuid, uuid) from public, anon;
grant execute on function public.move_medical_report(uuid, uuid) to authenticated, service_role;

-- 7. Aktualizacja get_pet_record_bundle: filtr deleted_at is null + lista kosza (trashed_reports)
create or replace function public.get_pet_record_bundle(
  p_pet_id uuid,
  p_requested_report_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pet public.zwierze%rowtype;
  v_household jsonb;
  v_members jsonb;
  v_switcher_pets jsonb;
  v_notification_settings jsonb;
  v_reports jsonb;
  v_trashed_reports jsonb;
  v_weights jsonb;
  v_vital_measurements jsonb;
  v_fluids jsonb;
  v_health_events jsonb;
  v_schedule_items jsonb;
  v_medication_schedules jsonb;
  v_medication_logs jsonb;
begin
  -- 1. Load pet (RLS enforces household membership)
  select z.*
  into v_pet
  from public.zwierze z
  where z.id = p_pet_id;

  if not found then
    return null;
  end if;

  -- 2. Household core fields (RLS enforced)
  select jsonb_build_object(
    'id', g.id,
    'nazwa', g.nazwa,
    'owner_id', g.owner_id,
    'recovery_email', g.recovery_email,
    'recovery_key_set_at', g.recovery_key_set_at
  )
  into v_household
  from public.gospodarstwo g
  where g.id = v_pet.gospodarstwo_id;

  -- 3. Household members (narrow columns for roles & display names)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'email', m.email,
        'rola', m.rola
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.czlonek_gospodarstwa m
  where m.gospodarstwo_id = v_pet.gospodarstwo_id;

  -- 4. Active switcher pets (skipped when viewing an archived pet)
  if v_pet.archived_at is null then
    select coalesce(
      jsonb_agg(to_jsonb(sp) order by sp.created_at asc),
      '[]'::jsonb
    )
    into v_switcher_pets
    from (
      select z.id, z.imie, z.gatunek, z.avatar_path, z.tagi, z.created_at
      from public.zwierze z
      where z.gospodarstwo_id = v_pet.gospodarstwo_id
        and z.archived_at is null
      order by z.created_at asc
      limit 50
    ) sp;
  else
    v_switcher_pets := '[]'::jsonb;
  end if;

  -- 5. Household notification settings
  select to_jsonb(ns)
  into v_notification_settings
  from (
    select s.id, s.household_id, s.email_enabled, s.notify_7_days_before,
           s.notify_1_day_before, s.notify_day_of, s.custom_email
    from public.household_notification_settings s
    where s.household_id = v_pet.gospodarstwo_id
    limit 1
  ) ns;

  -- 6. Active medical reports (top 100 + optional deep-linked report) with nested rows & corrections
  with selected_reports as (
    select r.*
    from (
      select wb.*
      from public.wynik_badania wb
      where wb.zwierze_id = p_pet_id
        and wb.deleted_at is null
      order by wb.test_date desc, wb.confirmed_at desc
      limit 100
    ) r
    union
    select wb.*
    from public.wynik_badania wb
    where p_requested_report_id is not null
      and wb.zwierze_id = p_pet_id
      and wb.id = p_requested_report_id
      and wb.deleted_at is null
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(sr) || jsonb_build_object(
        'rows',
        coalesce(
          (
            select jsonb_agg(
              to_jsonb(pp) || jsonb_build_object(
                'correction',
                (
                  select to_jsonb(mc)
                  from public.measurement_correction mc
                  where mc.measurement_id = pp.id
                  limit 1
                )
              )
              order by pp.ordinal asc
            )
            from public.pomiar_parametru pp
            where pp.wynik_id = sr.id
          ),
          '[]'::jsonb
        )
      )
      order by sr.test_date desc, sr.confirmed_at desc
    ),
    '[]'::jsonb
  )
  into v_reports
  from selected_reports sr;

  -- 6b. Trashed medical reports (lightweight summary for restore/move/permanent delete)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', tr.id,
        'title', tr.title,
        'test_date', tr.test_date,
        'laboratory', tr.laboratory,
        'doctor', tr.doctor,
        'source_name', tr.source_name,
        'source_mime', tr.source_mime,
        'deleted_at', tr.deleted_at,
        'row_count', tr.row_count
      )
      order by tr.deleted_at desc
    ),
    '[]'::jsonb
  )
  into v_trashed_reports
  from (
    select
      wb.id,
      wb.title,
      wb.test_date,
      wb.laboratory,
      wb.doctor,
      wb.source_name,
      wb.source_mime,
      wb.deleted_at,
      (select count(*)::int from public.pomiar_parametru pp where pp.wynik_id = wb.id) as row_count
    from public.wynik_badania wb
    where wb.zwierze_id = p_pet_id
      and wb.deleted_at is not null
    order by wb.deleted_at desc
    limit 50
  ) tr;

  -- 7. Weights
  select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
  into v_weights
  from (
    select pw.*
    from public.pet_weight pw
    where pw.pet_id = p_pet_id
    order by pw.measured_on desc, pw.created_at desc
    limit 500
  ) w;

  -- 8. Vital measurements
  select coalesce(jsonb_agg(to_jsonb(vm)), '[]'::jsonb)
  into v_vital_measurements
  from (
    select pv.*
    from public.pet_vital_measurement pv
    where pv.pet_id = p_pet_id
    order by pv.measured_on desc, pv.measured_at desc, pv.created_at desc
    limit 500
  ) vm;

  -- 9. Fluid therapies
  select coalesce(jsonb_agg(to_jsonb(ft)), '[]'::jsonb)
  into v_fluids
  from (
    select pf.*
    from public.pet_fluid_therapy pf
    where pf.pet_id = p_pet_id
    order by pf.administered_on desc, pf.administered_at desc, pf.created_at desc
    limit 500
  ) ft;

  -- 10. Health events
  select coalesce(jsonb_agg(to_jsonb(he)), '[]'::jsonb)
  into v_health_events
  from (
    select pe.*
    from public.pet_health_event pe
    where pe.pet_id = p_pet_id
    order by pe.event_date desc, pe.created_at desc
    limit 300
  ) he;

  -- 11. Schedule items
  select coalesce(jsonb_agg(to_jsonb(si)), '[]'::jsonb)
  into v_schedule_items
  from (
    select ps.*
    from public.pet_schedule_item ps
    where ps.pet_id = p_pet_id
    order by ps.scheduled_date asc, ps.created_at desc
    limit 200
  ) si;

  -- 12. Medication schedules
  select coalesce(jsonb_agg(to_jsonb(ms)), '[]'::jsonb)
  into v_medication_schedules
  from (
    select m.id, m.pet_id, m.household_id, m.name, m.dosage, m.schedule_type,
           m.interval_value, m.interval_unit, m.start_date, m.end_date,
           m.scheduled_time, m.scheduled_times, m.instructions, m.is_active,
           m.stock_quantity, m.low_stock_threshold, m.stock_unit,
           m.schedule_category, m.fluid_name, m.fluid_volume_ml,
           m.fluid_route, m.fluid_location, m.revision, m.created_by,
           m.created_at, m.updated_at
    from public.medication_schedules m
    where m.pet_id = p_pet_id
    order by m.start_date asc, m.created_at desc
    limit 200
  ) ms;

  -- 13. Medication logs
  select coalesce(jsonb_agg(to_jsonb(ml)), '[]'::jsonb)
  into v_medication_logs
  from (
    select l.id, l.schedule_id, l.pet_id, l.household_id, l.dose_date,
           l.scheduled_time, l.administered_at, l.status, l.administered_by,
           l.notes, l.revision, l.created_by, l.created_at, l.updated_at
    from public.medication_logs l
    where l.pet_id = p_pet_id
    order by l.dose_date desc, l.administered_at desc
    limit 300
  ) ml;

  return jsonb_build_object(
    'pet', to_jsonb(v_pet),
    'household', v_household,
    'members', v_members,
    'switcher_pets', v_switcher_pets,
    'notification_settings', v_notification_settings,
    'reports', v_reports,
    'trashed_reports', v_trashed_reports,
    'weights', v_weights,
    'vital_measurements', v_vital_measurements,
    'fluids', v_fluids,
    'health_events', v_health_events,
    'schedule_items', v_schedule_items,
    'medication_schedules', v_medication_schedules,
    'medication_logs', v_medication_logs
  );
end;
$$;

revoke all on function public.get_pet_record_bundle(uuid, uuid) from public, anon;
grant execute on function public.get_pet_record_bundle(uuid, uuid) to authenticated, service_role;

-- 8. Aktualizacja get_household_dashboard_bundle: pominięcie badań z kosza
create or replace function public.get_household_dashboard_bundle(
  p_selected_household_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household public.gospodarstwo%rowtype;
  v_is_owner boolean := false;
  v_member_role text := null;
  v_can_manage boolean := false;
  v_pets jsonb;
  v_health_events jsonb;
  v_schedule_items jsonb;
  v_notification_settings jsonb;
  v_reports_summary jsonb;
  v_medication_schedules jsonb;
  v_medication_logs jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  -- 1. Resolve active household (priority: selected -> oldest owned -> oldest member -> any RLS-visible)
  if p_selected_household_id is not null then
    select g.*
    into v_household
    from public.gospodarstwo g
    where g.id = p_selected_household_id
      and (
        g.owner_id = v_uid
        or exists (
          select 1
          from public.czlonek_gospodarstwa m
          where m.gospodarstwo_id = g.id
            and m.user_id = v_uid
        )
      )
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.gospodarstwo g
    where g.owner_id = v_uid
    order by g.created_at asc
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.czlonek_gospodarstwa m
    join public.gospodarstwo g on g.id = m.gospodarstwo_id
    where m.user_id = v_uid
    order by m.created_at asc
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.gospodarstwo g
    order by g.created_at asc
    limit 1;
  end if;

  if v_household.id is null then
    return null;
  end if;

  -- 2. Resolve role in active household
  v_is_owner := (v_household.owner_id = v_uid);
  select m.rola
  into v_member_role
  from public.czlonek_gospodarstwa m
  where m.gospodarstwo_id = v_household.id
    and m.user_id = v_uid
  limit 1;

  v_can_manage := v_is_owner or (v_member_role = 'admin');

  -- 3. Pets with active report counts
  select coalesce(
    jsonb_agg(
      to_jsonb(z) || jsonb_build_object('report_count', coalesce(rc.cnt, 0))
      order by z.created_at asc
    ),
    '[]'::jsonb
  )
  into v_pets
  from public.zwierze z
  left join (
    select wb.zwierze_id, count(*)::int as cnt
    from public.wynik_badania wb
    where wb.gospodarstwo_id = v_household.id
      and wb.deleted_at is null
    group by wb.zwierze_id
  ) rc on rc.zwierze_id = z.id
  where z.gospodarstwo_id = v_household.id;

  -- 4. Health events (limit 500)
  select coalesce(
    jsonb_agg(to_jsonb(he) order by he.event_date desc, he.created_at desc),
    '[]'::jsonb
  )
  into v_health_events
  from (
    select pe.*
    from public.pet_health_event pe
    where pe.household_id = v_household.id
    order by pe.event_date desc, pe.created_at desc
    limit 500
  ) he;

  -- 5. Schedule items (limit 300)
  select coalesce(
    jsonb_agg(to_jsonb(si) order by si.scheduled_date asc, si.created_at desc),
    '[]'::jsonb
  )
  into v_schedule_items
  from (
    select ps.*
    from public.pet_schedule_item ps
    where ps.household_id = v_household.id
    order by ps.scheduled_date asc, ps.created_at desc
    limit 300
  ) si;

  -- 6. Notification settings
  select to_jsonb(ns)
  into v_notification_settings
  from (
    select s.id, s.household_id, s.email_enabled, s.notify_7_days_before,
           s.notify_1_day_before, s.notify_day_of, s.custom_email
    from public.household_notification_settings s
    where s.household_id = v_household.id
    limit 1
  ) ns;

  -- 7. Calendar active reports summary (limit 400)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rs.id,
        'pet_id', rs.zwierze_id,
        'title', rs.title,
        'test_date', rs.test_date,
        'laboratory', rs.laboratory,
        'doctor', rs.doctor
      )
      order by rs.test_date desc, rs.confirmed_at desc
    ),
    '[]'::jsonb
  )
  into v_reports_summary
  from (
    select wb.id, wb.zwierze_id, wb.title, wb.test_date, wb.laboratory, wb.doctor, wb.confirmed_at
    from public.wynik_badania wb
    where wb.gospodarstwo_id = v_household.id
      and wb.deleted_at is null
    order by wb.test_date desc, wb.confirmed_at desc
    limit 400
  ) rs;

  -- 8. Medication schedules (limit 200)
  select coalesce(
    jsonb_agg(to_jsonb(ms) order by ms.start_date asc, ms.created_at desc),
    '[]'::jsonb
  )
  into v_medication_schedules
  from (
    select m.id, m.pet_id, m.household_id, m.name, m.dosage, m.schedule_type,
           m.interval_value, m.interval_unit, m.start_date, m.end_date,
           m.scheduled_time, m.scheduled_times, m.instructions, m.is_active,
           m.stock_quantity, m.low_stock_threshold, m.stock_unit,
           m.schedule_category, m.fluid_name, m.fluid_volume_ml,
           m.fluid_route, m.fluid_location, m.revision, m.created_by,
           m.created_at, m.updated_at
    from public.medication_schedules m
    where m.household_id = v_household.id
    order by m.start_date asc, m.created_at desc
    limit 200
  ) ms;

  -- 9. Medication logs (limit 500)
  select coalesce(
    jsonb_agg(to_jsonb(ml) order by ml.dose_date desc, ml.administered_at desc),
    '[]'::jsonb
  )
  into v_medication_logs
  from (
    select l.id, l.schedule_id, l.pet_id, l.household_id, l.dose_date,
           l.scheduled_time, l.administered_at, l.status, l.administered_by,
           l.notes, l.revision, l.created_by, l.created_at, l.updated_at
    from public.medication_logs l
    where l.household_id = v_household.id
    order by l.dose_date desc, l.administered_at desc
    limit 500
  ) ml;

  return jsonb_build_object(
    'household', jsonb_build_object(
      'id', v_household.id,
      'nazwa', v_household.nazwa,
      'owner_id', v_household.owner_id,
      'is_owner', v_is_owner,
      'can_manage', v_can_manage,
      'has_recovery_key', (v_household.recovery_key_set_at is not null),
      'recovery_email', case when v_can_manage then v_household.recovery_email else null end
    ),
    'pets', v_pets,
    'health_events', v_health_events,
    'schedule_items', v_schedule_items,
    'notification_settings', v_notification_settings,
    'reports_summary', v_reports_summary,
    'medication_schedules', v_medication_schedules,
    'medication_logs', v_medication_logs
  );
end;
$$;

revoke all on function public.get_household_dashboard_bundle(uuid) from public, anon;
grant execute on function public.get_household_dashboard_bundle(uuid) to authenticated, service_role;

-- 9. Automatyczne czyszczenie kosza (>30 dni) oraz wygasłego cache odrzuconych hashy (>24h)
create or replace function private.purge_expired_deleted_reports()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports_deleted integer := 0;
  v_hashes_deleted integer := 0;
begin
  -- Pozwala posprzątać przeterminowany kosz nawet jeśli pupil został później zarchiwizowany
  perform set_config('caremypet.allow_pet_archive_transition', '1', true);
  perform set_config('caremypet.allow_recovery_bypass', '1', true);

  delete from public.wynik_badania
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';
  get diagnostics v_reports_deleted = row_count;

  delete from private.rejected_document_hash
  where expires_at < now();
  get diagnostics v_hashes_deleted = row_count;

  return jsonb_build_object(
    'reports_deleted', v_reports_deleted,
    'rejected_hashes_deleted', v_hashes_deleted
  );
end;
$$;

revoke all on function private.purge_expired_deleted_reports() from public, anon, authenticated;
grant execute on function private.purge_expired_deleted_reports() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'care_my_pet_daily_medical_trash_purge') then
    perform cron.unschedule('care_my_pet_daily_medical_trash_purge');
  end if;
  perform cron.schedule(
    'care_my_pet_daily_medical_trash_purge',
    '30 3 * * *',
    'select private.purge_expired_deleted_reports();'
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
