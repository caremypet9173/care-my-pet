-- ==============================================================================
-- Migracja: security_and_runtime_fixes (Pakiet 1 + 12 MB + Opcja A)
-- 1. P0.1 / P0.2: Zamknięcie cross-tenant IDOR w pet_share_link i pet_archive_link
-- 2. P0.3: Zamknięcie wycieku PII i przejęcia pilot_whitelist oraz waitlist
-- 3. P0.4 + Opcja A: Zamknięcie eskalacji zaproszenie_update + separacja owner/admin
-- 4. P0.5: Sekret cron_dispatch dla schedule-notifications (pg_cron -> Edge Function)
-- 5. P0.6 / P0.6b: Naprawa 3 aktywnych błędów SQL z db lint:
--    - import_clinical_discharge_batch (42703)
--    - recovery_create_claim (42702)
--    - recovery_execute_claim (42702)
-- 6. P0.9: Zamknięcie otwartego RLS pet_assistant_*, timeout w ai_usage_log,
--    ograniczenie log_ai_usage wyłącznie do service_role
-- 7. P0.10: Podniesienie limitu bucketu medical-documents do 12 MB
-- 8. P1 #2 / #5 / P2: Domknięcie obejść PT423/PT428, IDOR pet_push_subscription,
--    RLS na tabelach private.household_recovery_* oraz guard household_has_recovery_key
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Pomocnicza funkcja: ścisłe sprawdzenie właściciela domostwa (Opcja A)
-- ------------------------------------------------------------------------------
create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gospodarstwo g
    where g.id = p_household_id
      and g.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;

-- Ograniczenie household_has_recovery_key do własnych domostw dla roli authenticated
create or replace function public.household_has_recovery_key(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gospodarstwo g
    where g.id = p_household_id
      and g.recovery_key_set_at is not null
      and (
        (select auth.uid()) is null
        or g.id in (select public.get_user_household_ids())
      )
  );
$$;

revoke all on function public.household_has_recovery_key(uuid) from public, anon;
grant execute on function public.household_has_recovery_key(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. P0.1: Ochrona public.pet_share_link przed cross-tenant IDOR + PT423/PT428
-- ------------------------------------------------------------------------------
create or replace function public.validate_pet_share_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text := coalesce(current_setting('role', true), '');
  v_is_service boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not exists (
    select 1
    from public.zwierze z
    where z.id = new.pet_id
      and z.gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet does not belong to household' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and not v_is_service then
    if (new.id, new.pet_id, new.household_id, new.token, new.ttl_hours, new.expires_at, new.created_by, new.created_at)
       is distinct from
       (old.id, old.pet_id, old.household_id, old.token, old.ttl_hours, old.expires_at, old.created_by, old.created_at) then
      raise exception 'Immutable share link fields' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_pet_share_link() from public, anon, authenticated;

drop trigger if exists pet_share_link_validate on public.pet_share_link;
create trigger pet_share_link_validate
  before insert or update on public.pet_share_link
  for each row execute function public.validate_pet_share_link();

-- Zoptymalizowane polityki RLS na pet_share_link i pet_share_open_log
drop policy if exists pet_share_link_read on public.pet_share_link;
create policy pet_share_link_read on public.pet_share_link
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists pet_share_link_insert on public.pet_share_link;
create policy pet_share_link_insert on public.pet_share_link
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
    and exists (
      select 1 from public.zwierze z
      where z.id = pet_id and z.gospodarstwo_id = household_id
    )
  );

drop policy if exists pet_share_link_update on public.pet_share_link;
create policy pet_share_link_update on public.pet_share_link
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists pet_share_link_delete on public.pet_share_link;
create policy pet_share_link_delete on public.pet_share_link
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists pet_share_open_log_read on public.pet_share_open_log;
create policy pet_share_open_log_read on public.pet_share_open_log
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- ------------------------------------------------------------------------------
-- 3. P0.2: Ochrona public.pet_archive_link przed cross-tenant IDOR
-- ------------------------------------------------------------------------------
drop policy if exists pet_archive_link_owner_update on public.pet_archive_link;

create or replace function public.validate_pet_archive_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text := coalesce(current_setting('role', true), '');
  v_is_service boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not exists (
    select 1
    from public.zwierze z
    where z.id = new.pet_id
      and z.gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet does not belong to household' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and not v_is_service then
    if (new.id, new.pet_id, new.household_id, new.token, new.recipient_email, new.access_code_hash, new.access_code_salt, new.expires_at, new.created_by, new.created_at)
       is distinct from
       (old.id, old.pet_id, old.household_id, old.token, old.recipient_email, old.access_code_hash, old.access_code_salt, old.expires_at, old.created_by, old.created_at) then
      raise exception 'Immutable archive link fields' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_pet_archive_link() from public, anon, authenticated;

drop trigger if exists pet_archive_link_validate on public.pet_archive_link;
create trigger pet_archive_link_validate
  before insert or update on public.pet_archive_link
  for each row execute function public.validate_pet_archive_link();

-- ------------------------------------------------------------------------------
-- 4. P0.3: Zamknięcie wycieku PII i przejęcia pilot_whitelist oraz waitlist
-- ------------------------------------------------------------------------------
drop policy if exists pilot_whitelist_read on public.pilot_whitelist;
drop policy if exists pilot_whitelist_admin_all on public.pilot_whitelist;
drop policy if exists waitlist_admin_all on public.waitlist;

drop policy if exists waitlist_insert_all on public.waitlist;
create policy waitlist_insert_all on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    and pets_count between 1 and 50
    and status = 'pending'
    and coalesce(notes, '') = ''
  );

create or replace function public.add_pilot_email(p_email text, p_notes text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text := lower(btrim(p_email));
begin
  if v_norm is null or v_norm !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into public.pilot_whitelist (email, notes)
  values (v_norm, coalesce(p_notes, ''))
  on conflict (email) do update
  set notes = excluded.notes;

  return true;
end;
$$;

revoke all on function public.add_pilot_email(text, text) from public, anon, authenticated;
grant execute on function public.add_pilot_email(text, text) to service_role;

create or replace function public.approve_waitlist_entry(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_norm_email text;
begin
  select * into v_entry from public.waitlist where id = p_id;
  if not found then
    return false;
  end if;

  v_norm_email := lower(btrim(v_entry.email));

  insert into public.pilot_whitelist (email, notes)
  values (v_norm_email, 'Z listy oczekujących (' || v_entry.pets_count || ' pupili)')
  on conflict (email) do update
  set notes = excluded.notes;

  update public.waitlist
  set status = 'invited'
  where id = p_id;

  return true;
end;
$$;

revoke all on function public.approve_waitlist_entry(uuid) from public, anon, authenticated;
grant execute on function public.approve_waitlist_entry(uuid) to service_role;

-- ------------------------------------------------------------------------------
-- 5. P0.4 + Opcja A: Separacja ról owner vs admin oraz blokada zaproszenie_update
-- ------------------------------------------------------------------------------
drop policy if exists membership_insert on public.czlonek_gospodarstwa;
create policy membership_insert on public.czlonek_gospodarstwa
  for insert to authenticated
  with check (
    public.is_household_owner(gospodarstwo_id)
    or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
  );

drop policy if exists membership_update on public.czlonek_gospodarstwa;
create policy membership_update on public.czlonek_gospodarstwa
  for update to authenticated
  using (public.is_household_owner(gospodarstwo_id))
  with check (public.is_household_owner(gospodarstwo_id));

drop policy if exists membership_delete on public.czlonek_gospodarstwa;
create policy membership_delete on public.czlonek_gospodarstwa
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_household_owner(gospodarstwo_id)
    or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
  );

drop policy if exists zaproszenie_insert on public.zaproszenie_gospodarstwa;
create policy zaproszenie_insert on public.zaproszenie_gospodarstwa
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.is_household_owner(gospodarstwo_id)
      or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
    )
  );

drop policy if exists zaproszenie_update on public.zaproszenie_gospodarstwa;
create policy zaproszenie_update on public.zaproszenie_gospodarstwa
  for update to authenticated
  using (
    public.is_household_owner(gospodarstwo_id)
    or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
  )
  with check (
    public.is_household_owner(gospodarstwo_id)
    or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
  );

drop policy if exists zaproszenie_delete on public.zaproszenie_gospodarstwa;
create policy zaproszenie_delete on public.zaproszenie_gospodarstwa
  for delete to authenticated
  using (
    public.is_household_owner(gospodarstwo_id)
    or (public.is_household_admin(gospodarstwo_id) and rola = 'member')
  );

create or replace function public.guard_zaproszenie_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text := coalesce(current_setting('role', true), '');
  v_is_service boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not v_is_service then
    if (new.id, new.gospodarstwo_id, new.email, new.token, new.rola, new.created_by, new.created_at, new.expires_at)
       is distinct from
       (old.id, old.gospodarstwo_id, old.email, old.token, old.rola, old.created_by, old.created_at, old.expires_at) then
      raise exception 'Immutable invitation fields' using errcode = '42501';
    end if;
    if new.status not in ('cancelled', old.status) then
      raise exception 'Only cancellation is permitted directly' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_zaproszenie_update() from public, anon, authenticated;

drop trigger if exists guard_zaproszenie_update on public.zaproszenie_gospodarstwa;
create trigger guard_zaproszenie_update
  before update on public.zaproszenie_gospodarstwa
  for each row execute function public.guard_zaproszenie_update();

-- Opcja A + domknięcie PT428 przy INSERT: ochrona pól gospodarstwa i recovery_email
create or replace function public.guard_household_recovery_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allow text := coalesce(current_setting('caremypet.allow_recovery_meta', true), '');
  v_role text := coalesce(current_setting('role', true), '');
  v_is_service boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not v_is_service and v_allow <> '1' then
    if tg_op = 'INSERT' then
      new.recovery_key_hint := null;
      new.recovery_key_set_at := null;
      new.recovery_key_set_by := null;
    elsif tg_op = 'UPDATE' then
      if new.owner_id is distinct from old.owner_id
         or new.recovery_key_hint is distinct from old.recovery_key_hint
         or new.recovery_key_set_at is distinct from old.recovery_key_set_at
         or new.recovery_key_set_by is distinct from old.recovery_key_set_by then
        raise exception 'Recovery metadata can only be updated by server workflow' using errcode = '42501';
      end if;

      if new.recovery_email is distinct from old.recovery_email
         and old.owner_id is distinct from (select auth.uid()) then
        raise exception 'Only household owner can update recovery email' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_household_recovery_fields() from public, anon, authenticated;

drop trigger if exists guard_household_recovery_fields on public.gospodarstwo;
create trigger guard_household_recovery_fields
  before insert or update on public.gospodarstwo
  for each row execute function public.guard_household_recovery_fields();

-- ------------------------------------------------------------------------------
-- 6. P0.5: Uwierzytelnienie wywołania pg_cron -> schedule-notifications
-- ------------------------------------------------------------------------------
create table if not exists private.cron_dispatch_secret (
  id integer primary key check (id = 1),
  secret text not null check (char_length(secret) >= 32),
  created_at timestamptz not null default now()
);

alter table private.cron_dispatch_secret enable row level security;
revoke all on private.cron_dispatch_secret from public, anon, authenticated;
grant select on private.cron_dispatch_secret to service_role;

insert into private.cron_dispatch_secret (id, secret)
values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

create or replace function private.invoke_schedule_notifications_cron()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.secret into v_secret
  from private.cron_dispatch_secret s
  where s.id = 1;

  perform net.http_post(
    url := 'https://lrlnqmciarjvngvquchu.supabase.co/functions/v1/schedule-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := '{"action": "cron_dispatch"}'::jsonb
  );
end;
$$;

revoke all on function private.invoke_schedule_notifications_cron() from public, anon, authenticated;

create or replace function public.verify_cron_dispatch_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.cron_dispatch_secret s
    where s.id = 1
      and p_secret is not null
      and char_length(p_secret) >= 32
      and s.secret = p_secret
  );
$$;

revoke all on function public.verify_cron_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_dispatch_secret(text) to service_role;

-- ------------------------------------------------------------------------------
-- 7. P0.6: Naprawa public.import_clinical_discharge_batch (42703)
-- ------------------------------------------------------------------------------
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
  v_ordinal integer := 0;
  v_category text;
  v_metric_type text;
  v_unit text;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select z.gospodarstwo_id into strict v_home_id
  from public.zwierze z
  where z.id = p_pet_id;

  -- 1. Badania laboratoryjne i obrazowe (wynik_badania + pomiar_parametru)
  if jsonb_typeof(p_data->'lab_reports') = 'array' then
    for v_rep in select value from jsonb_array_elements(p_data->'lab_reports') loop
      exit when v_rep_count >= 50;
      v_rep_id := coalesce((v_rep->>'id')::uuid, gen_random_uuid());

      insert into public.wynik_badania (
        id,
        zwierze_id,
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
        v_uid
      );

      v_ordinal := 0;
      if jsonb_typeof(v_rep->'parameters') = 'array' then
        for v_param in select value from jsonb_array_elements(v_rep->'parameters') loop
          exit when v_ordinal >= 100;
          v_ordinal := v_ordinal + 1;
          v_category := coalesce(v_param->>'category', 'other');
          if v_category not in ('blood', 'renal', 'liver', 'other') then
            v_category := 'other';
          end if;

          insert into public.pomiar_parametru (
            wynik_id,
            gospodarstwo_id,
            ordinal,
            name,
            value,
            unit,
            reference,
            category
          ) values (
            v_rep_id,
            v_home_id,
            v_ordinal,
            coalesce(nullif(btrim(v_param->>'name'), ''), 'Parametr'),
            coalesce(nullif(btrim(v_param->>'value'), ''), '-'),
            coalesce(v_param->>'unit', ''),
            coalesce(v_param->>'reference', ''),
            v_category
          );
        end loop;
      end if;

      v_rep_count := v_rep_count + 1;
    end loop;
  end if;

  -- 2. Wizyty kliniczne, szczepienia i profilaktyka (pet_health_event)
  if jsonb_typeof(p_data->'clinical_events') = 'array' then
    for v_ev in select value from jsonb_array_elements(p_data->'clinical_events') loop
      exit when v_ev_count >= 50;
      v_category := coalesce(v_ev->>'category', 'visit');
      if v_category not in ('visit', 'vaccination', 'prevention') then
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
        v_uid
      );
      v_ev_count := v_ev_count + 1;
    end loop;
  end if;

  -- 3. Pomiary wagi (pet_weight)
  if jsonb_typeof(p_data->'weights') = 'array' then
    for v_wt in select value from jsonb_array_elements(p_data->'weights') loop
      exit when v_wt_count >= 100;
      insert into public.pet_weight (
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
        v_uid
      );
      v_wt_count := v_wt_count + 1;
    end loop;
  end if;

  -- 4. Pomiary parametrów życiowych (pet_vital_measurement)
  if jsonb_typeof(p_data->'vitals') = 'array' then
    for v_vt in select value from jsonb_array_elements(p_data->'vitals') loop
      exit when v_vt_count >= 100;
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
          v_uid
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
end;
$$;

revoke all on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_clinical_discharge_batch(uuid, text, text, text, text, jsonb) to authenticated;

-- ------------------------------------------------------------------------------
-- 8. P0.6b: Naprawa błędów 42702 (ambiguous household_id) w recovery_*_claim
-- ------------------------------------------------------------------------------
create or replace function public.recovery_create_claim(
  p_household_id uuid,
  p_previous_owner_id uuid,
  p_target_email text,
  p_token text,
  p_expires_at timestamptz
)
returns table (
  claim_id uuid,
  household_id uuid,
  target_email text,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := now();
  v_claim_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 22));

  update private.household_recovery_claim c
  set revoked_at = v_now
  where c.household_id = p_household_id
    and c.confirmed_at is null
    and c.revoked_at is null;

  update private.household_recovery_secret s
  set failed_attempts = 0,
      locked_until = null,
      updated_at = v_now
  where s.household_id = p_household_id;

  insert into private.household_recovery_claim (
    household_id,
    previous_owner_id,
    target_email,
    token,
    expires_at
  )
  values (
    p_household_id,
    p_previous_owner_id,
    lower(btrim(p_target_email)),
    p_token,
    p_expires_at
  )
  returning id into v_claim_id;

  return query
  select v_claim_id, p_household_id, lower(btrim(p_target_email)), p_token, p_expires_at;
end;
$$;

revoke all on function public.recovery_create_claim(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.recovery_create_claim(uuid, uuid, text, text, timestamptz) to service_role;

create or replace function public.recovery_execute_claim(
  p_token text,
  p_new_owner_id uuid
)
returns table (
  household_id uuid,
  household_name text,
  previous_owner_id uuid,
  target_email text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := now();
  v_claim private.household_recovery_claim;
  v_household public.gospodarstwo;
  v_user_email text;
begin
  select * into v_claim
  from private.household_recovery_claim c
  where c.token = p_token
  for update;

  if not found then
    raise exception 'Recovery claim not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_claim.household_id::text, 23));

  if v_claim.confirmed_at is not null then
    raise exception 'Recovery claim already confirmed' using errcode = 'PT409';
  end if;

  if v_claim.revoked_at is not null then
    raise exception 'Recovery claim revoked' using errcode = 'PT410';
  end if;

  if v_claim.expires_at <= v_now then
    raise exception 'Recovery claim expired' using errcode = 'PT410';
  end if;

  select u.email::text into v_user_email
  from auth.users u
  where u.id = p_new_owner_id;

  if v_user_email is null or lower(btrim(v_user_email)) <> lower(btrim(v_claim.target_email)) then
    raise exception 'Email mismatch for recovery claim' using errcode = '42501';
  end if;

  select * into v_household
  from public.gospodarstwo g
  where g.id = v_claim.household_id
  for update;

  if not found then
    raise exception 'Household not found' using errcode = 'P0002';
  end if;

  delete from public.czlonek_gospodarstwa cm
  where cm.gospodarstwo_id = v_claim.household_id
    and cm.user_id in (v_claim.previous_owner_id, v_household.owner_id, p_new_owner_id);

  update public.household_admin_request r
  set status = 'cancelled',
      resolved_at = v_now,
      resolved_by = p_new_owner_id
  where r.household_id = v_claim.household_id
    and r.status = 'pending';

  perform set_config('caremypet.allow_recovery_meta', '1', true);

  update public.gospodarstwo g
  set owner_id = p_new_owner_id,
      recovery_key_hint = null,
      recovery_key_set_at = null,
      recovery_key_set_by = null,
      recovery_email = null
  where g.id = v_claim.household_id;

  delete from private.household_recovery_secret s
  where s.household_id = v_claim.household_id;

  update private.household_recovery_claim c
  set confirmed_at = v_now,
      confirmed_by = p_new_owner_id
  where c.id = v_claim.id;

  update private.household_recovery_claim c
  set revoked_at = v_now
  where c.household_id = v_claim.household_id
    and c.id <> v_claim.id
    and c.confirmed_at is null
    and c.revoked_at is null;

  return query
  select v_household.id, v_household.nazwa, v_household.owner_id, v_claim.target_email;
end;
$$;

revoke all on function public.recovery_execute_claim(text, uuid) from public, anon, authenticated;
grant execute on function public.recovery_execute_claim(text, uuid) to service_role;

-- ------------------------------------------------------------------------------
-- 9. P0.9: Zamknięcie otwartego RLS Asystenta AI + timeout w ai_usage_log
--    + ograniczenie log_ai_usage wyłącznie do service_role
-- ------------------------------------------------------------------------------
drop policy if exists assistant_thread_insert on public.pet_assistant_thread;
drop policy if exists assistant_thread_update on public.pet_assistant_thread;
drop policy if exists assistant_message_insert on public.pet_assistant_message;

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
  check (status in ('ok', 'http_error', 'invalid_output', 'timeout'));

drop function if exists public.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer);
drop function if exists private.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer);

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
    when p_status in ('ok', 'http_error', 'invalid_output', 'timeout') then p_status
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

create or replace function public.log_ai_usage(
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
language sql
security definer
set search_path = ''
as $$
  select private.log_ai_usage(
    p_pet_id,
    p_feature,
    p_model,
    p_mime_type,
    p_file_size_bytes,
    p_prompt_tokens,
    p_output_tokens,
    p_thoughts_tokens,
    p_total_tokens,
    p_duration_ms,
    p_status,
    p_http_status,
    p_user_id
  );
$$;

revoke all on function public.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer, uuid) to service_role;

-- ------------------------------------------------------------------------------
-- 10. P0.10: Podniesienie limitu bucketu Storage medical-documents do 12 MB
-- ------------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 12582912
where id = 'medical-documents';

-- ------------------------------------------------------------------------------
-- 11. P1 #2: Domknięcie obejść PT423 (archiwizacja) i PT428 (klucz odzyskania)
-- ------------------------------------------------------------------------------
create or replace function public.guard_archived_pet_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allow text := coalesce(current_setting('caremypet.allow_pet_archive_transition', true), '');
  v_role text := coalesce(current_setting('role', true), '');
  v_is_admin boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not v_is_admin and v_allow <> '1' then
    if tg_op = 'INSERT' then
      if new.archived_at is not null
         or new.archived_by is not null
         or new.archive_reason is not null
         or new.closed_on is not null
         or new.archive_note is not null then
        raise exception 'Use archive_pet to archive a pet record' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.archived_at is distinct from old.archived_at
         or new.archived_by is distinct from old.archived_by
         or new.archive_reason is distinct from old.archive_reason
         or new.closed_on is distinct from old.closed_on
         or new.archive_note is distinct from old.archive_note then
        raise exception 'Use archive_pet or restore_pet to change archive state' using errcode = '42501';
      end if;

      if old.archived_at is not null then
        raise exception 'Pet record is archived' using errcode = 'PT423';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_archived_pet_update() from public, anon, authenticated;

drop trigger if exists guard_archived_pet_update on public.zwierze;
create trigger guard_archived_pet_update
  before insert or update on public.zwierze
  for each row execute function public.guard_archived_pet_update();

-- Sprawdzenie ZARÓWNO OLD, jak i NEW w reject_archived_pet_mutation (blokuje zmianę pet_id z zarchiwizowanego pupila)
create or replace function public.reject_archived_pet_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := tg_argv[0];
  v_old_pet_id uuid;
  v_new_pet_id uuid;
  v_archived_at timestamptz;
  v_role text := coalesce(current_setting('role', true), '');
begin
  if coalesce(current_setting('caremypet.allow_pet_archive_transition', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' and auth.uid() is null and v_role in ('postgres', 'supabase_admin') then
    return old;
  end if;

  if v_kind = 'zwierze_id' then
    if tg_op in ('UPDATE', 'DELETE') then v_old_pet_id := old.zwierze_id; end if;
    if tg_op in ('INSERT', 'UPDATE') then v_new_pet_id := new.zwierze_id; end if;
  elsif v_kind = 'pet_id' then
    if tg_op in ('UPDATE', 'DELETE') then v_old_pet_id := old.pet_id; end if;
    if tg_op in ('INSERT', 'UPDATE') then v_new_pet_id := new.pet_id; end if;
  elsif v_kind = 'wynik_id' then
    if tg_op in ('UPDATE', 'DELETE') then
      select w.zwierze_id into v_old_pet_id from public.wynik_badania w where w.id = old.wynik_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select w.zwierze_id into v_new_pet_id from public.wynik_badania w where w.id = new.wynik_id;
    end if;
  elsif v_kind = 'measurement_id' then
    if tg_op in ('UPDATE', 'DELETE') then
      select w.zwierze_id into v_old_pet_id
      from public.pomiar_parametru p
      join public.wynik_badania w on w.id = p.wynik_id
      where p.id = old.measurement_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select w.zwierze_id into v_new_pet_id
      from public.pomiar_parametru p
      join public.wynik_badania w on w.id = p.wynik_id
      where p.id = new.measurement_id;
    end if;
  end if;

  if v_old_pet_id is not null then
    select z.archived_at into v_archived_at from public.zwierze z where z.id = v_old_pet_id;
    if v_archived_at is not null then
      raise exception 'Pet record is archived' using errcode = 'PT423';
    end if;
  end if;

  if v_new_pet_id is not null and v_new_pet_id is distinct from v_old_pet_id then
    select z.archived_at into v_archived_at from public.zwierze z where z.id = v_new_pet_id;
    if v_archived_at is not null then
      raise exception 'Pet record is archived' using errcode = 'PT423';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.reject_archived_pet_mutation() from public, anon, authenticated;

-- Sprawdzenie ZARÓWNO OLD, jak i NEW w enforce_household_recovery_key
create or replace function public.enforce_household_recovery_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := tg_argv[0];
  v_old_hh uuid;
  v_new_hh uuid;
  v_old_pet uuid;
  v_new_pet uuid;
  v_has_key boolean;
  v_role text := coalesce(current_setting('role', true), '');
begin
  if coalesce(current_setting('caremypet.allow_recovery_bypass', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_role in ('postgres', 'supabase_admin', 'service_role') or auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_kind = 'household_id' then
    if tg_op in ('UPDATE', 'DELETE') then v_old_hh := old.gospodarstwo_id; end if;
    if tg_op in ('INSERT', 'UPDATE') then v_new_hh := new.gospodarstwo_id; end if;
  elsif v_kind = 'zwierze_id' then
    if tg_op in ('UPDATE', 'DELETE') then v_old_pet := old.zwierze_id; end if;
    if tg_op in ('INSERT', 'UPDATE') then v_new_pet := new.zwierze_id; end if;
  elsif v_kind = 'pet_id' then
    if tg_op in ('UPDATE', 'DELETE') then v_old_pet := old.pet_id; end if;
    if tg_op in ('INSERT', 'UPDATE') then v_new_pet := new.pet_id; end if;
  elsif v_kind = 'wynik_id' then
    if tg_op in ('UPDATE', 'DELETE') then
      select w.gospodarstwo_id into v_old_hh from public.wynik_badania w where w.id = old.wynik_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select w.gospodarstwo_id into v_new_hh from public.wynik_badania w where w.id = new.wynik_id;
    end if;
  elsif v_kind = 'measurement_id' then
    if tg_op in ('UPDATE', 'DELETE') then
      select w.gospodarstwo_id into v_old_hh
      from public.pomiar_parametru p
      join public.wynik_badania w on w.id = p.wynik_id
      where p.id = old.measurement_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select w.gospodarstwo_id into v_new_hh
      from public.pomiar_parametru p
      join public.wynik_badania w on w.id = p.wynik_id
      where p.id = new.measurement_id;
    end if;
  end if;

  if v_old_hh is null and v_old_pet is not null then
    select z.gospodarstwo_id into v_old_hh from public.zwierze z where z.id = v_old_pet;
  end if;
  if v_new_hh is null and v_new_pet is not null then
    select z.gospodarstwo_id into v_new_hh from public.zwierze z where z.id = v_new_pet;
  end if;

  if v_old_hh is not null then
    select (g.recovery_key_set_at is not null) into v_has_key from public.gospodarstwo g where g.id = v_old_hh;
    if coalesce(v_has_key, false) = false then
      raise exception 'Household recovery key is required' using errcode = 'PT428';
    end if;
  end if;

  if v_new_hh is not null and v_new_hh is distinct from v_old_hh then
    select (g.recovery_key_set_at is not null) into v_has_key from public.gospodarstwo g where g.id = v_new_hh;
    if coalesce(v_has_key, false) = false then
      raise exception 'Household recovery key is required' using errcode = 'PT428';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_household_recovery_key() from public, anon, authenticated;

-- Blokada tworzenia nowych linków udostępniania dla zarchiwizowanego pupila / bez klucza odzyskania
drop trigger if exists a_reject_archived_pet_mutation on public.pet_share_link;
create trigger a_reject_archived_pet_mutation
  before insert on public.pet_share_link
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_share_link;
create trigger b_enforce_household_recovery_key
  before insert on public.pet_share_link
  for each row execute function public.enforce_household_recovery_key('pet_id');

-- Niezmienność pet_id w medication_schedules i medication_logs
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
    if (new.id, new.pet_id, new.household_id, new.created_by, new.created_at)
       is distinct from (old.id, old.pet_id, old.household_id, old.created_by, old.created_at) then
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
    if (new.id, new.pet_id, new.household_id, new.created_by, new.created_at)
       is distinct from (old.id, old.pet_id, old.household_id, old.created_by, old.created_at) then
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

-- ------------------------------------------------------------------------------
-- 12. P1 #5: Zamknięcie IDOR w public.pet_push_subscription + wymóg https://
-- ------------------------------------------------------------------------------
drop policy if exists push_subscription_insert on public.pet_push_subscription;
create policy push_subscription_insert on public.pet_push_subscription
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (household_id is null or household_id in (select public.get_user_household_ids()))
    and endpoint ~ '^https://'
  );

drop policy if exists push_subscription_update on public.pet_push_subscription;
create policy push_subscription_update on public.pet_push_subscription
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (household_id is null or household_id in (select public.get_user_household_ids()))
    and endpoint ~ '^https://'
  );

-- ------------------------------------------------------------------------------
-- 13. Higiena prywatnych tabel recovery (REVOKE + ENABLE RLS)
-- ------------------------------------------------------------------------------
alter table private.household_recovery_secret enable row level security;
alter table private.household_recovery_claim enable row level security;
alter table private.recovery_rate_limit enable row level security;

revoke all on private.household_recovery_secret from public, anon, authenticated;
revoke all on private.household_recovery_claim from public, anon, authenticated;
revoke all on private.recovery_rate_limit from public, anon, authenticated;
