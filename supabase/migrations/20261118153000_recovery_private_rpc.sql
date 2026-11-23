-- ============================================================================
-- RPC w public (tylko dla service_role) do atomowej obsługi schematu private.*
-- oraz automatycznego zatwierdzania przeterminowanych wniosków o współadmina
-- ============================================================================

create or replace function public.recovery_find_user_by_email(p_email text)
returns table (
  user_id uuid,
  email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id as user_id, u.email::text
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.recovery_find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.recovery_find_user_by_email(text) to service_role;

create or replace function public.recovery_set_household_secret(
  p_household_id uuid,
  p_key_hash text,
  p_key_salt text,
  p_key_hint text,
  p_set_by uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 21));

  insert into private.household_recovery_secret (
    household_id,
    key_hash,
    key_salt,
    failed_attempts,
    locked_until,
    updated_at
  )
  values (
    p_household_id,
    p_key_hash,
    p_key_salt,
    0,
    null,
    v_now
  )
  on conflict (household_id) do update
    set key_hash = excluded.key_hash,
        key_salt = excluded.key_salt,
        failed_attempts = 0,
        locked_until = null,
        updated_at = v_now;

  perform set_config('caremypet.allow_recovery_meta', '1', true);

  update public.gospodarstwo
  set recovery_key_hint = p_key_hint,
      recovery_key_set_at = v_now,
      recovery_key_set_by = p_set_by
  where id = p_household_id;

  -- Rotacja klucza unieważnia oczekujące żądania odzyskania dla tego gospodarstwa
  update private.household_recovery_claim
  set revoked_at = v_now
  where household_id = p_household_id
    and confirmed_at is null
    and revoked_at is null;

  return v_now;
end;
$$;

revoke all on function public.recovery_set_household_secret(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.recovery_set_household_secret(uuid, text, text, text, uuid) to service_role;

create or replace function public.recovery_get_rate_limit(p_lookup_key text)
returns table (
  failed_attempts integer,
  locked_until timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.failed_attempts, r.locked_until, r.updated_at
  from private.recovery_rate_limit r
  where r.lookup_key = p_lookup_key;
$$;

revoke all on function public.recovery_get_rate_limit(text) from public, anon, authenticated;
grant execute on function public.recovery_get_rate_limit(text) to service_role;

create or replace function public.recovery_record_failed_attempt(
  p_lookup_key text,
  p_max_attempts integer default 5,
  p_lock_minutes integer default 15
)
returns table (
  failed_attempts integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_existing private.recovery_rate_limit;
  v_next_attempts integer;
  v_next_lock timestamptz;
begin
  select * into v_existing
  from private.recovery_rate_limit r
  where r.lookup_key = p_lookup_key
  for update;

  if not found then
    v_next_attempts := 1;
    v_next_lock := case when v_next_attempts >= p_max_attempts then v_now + make_interval(mins => p_lock_minutes) else null end;
    insert into private.recovery_rate_limit (lookup_key, failed_attempts, locked_until, updated_at)
    values (p_lookup_key, v_next_attempts, v_next_lock, v_now);
  else
    if v_existing.locked_until is not null and v_existing.locked_until <= v_now then
      v_next_attempts := 1;
    elsif v_existing.updated_at < v_now - make_interval(mins => p_lock_minutes) then
      v_next_attempts := 1;
    else
      v_next_attempts := v_existing.failed_attempts + 1;
    end if;

    v_next_lock := case
      when v_existing.locked_until is not null and v_existing.locked_until > v_now then v_existing.locked_until
      when v_next_attempts >= p_max_attempts then v_now + make_interval(mins => p_lock_minutes)
      else null
    end;

    update private.recovery_rate_limit
    set failed_attempts = v_next_attempts,
        locked_until = v_next_lock,
        updated_at = v_now
    where lookup_key = p_lookup_key;
  end if;

  return query select v_next_attempts, v_next_lock;
end;
$$;

revoke all on function public.recovery_record_failed_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.recovery_record_failed_attempt(text, integer, integer) to service_role;

create or replace function public.recovery_clear_rate_limit(p_lookup_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.recovery_rate_limit where lookup_key = p_lookup_key;
$$;

revoke all on function public.recovery_clear_rate_limit(text) from public, anon, authenticated;
grant execute on function public.recovery_clear_rate_limit(text) to service_role;

create or replace function public.recovery_get_owner_household_secrets(p_owner_email text)
returns table (
  household_id uuid,
  household_name text,
  owner_id uuid,
  owner_email text,
  recovery_email text,
  key_hash text,
  key_salt text,
  failed_attempts integer,
  locked_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id as household_id,
    g.nazwa as household_name,
    g.owner_id,
    u.email::text as owner_email,
    g.recovery_email,
    s.key_hash,
    s.key_salt,
    s.failed_attempts,
    s.locked_until
  from auth.users u
  join public.gospodarstwo g on g.owner_id = u.id
  join private.household_recovery_secret s on s.household_id = g.id
  where lower(u.email) = lower(btrim(p_owner_email))
  order by g.created_at asc;
$$;

revoke all on function public.recovery_get_owner_household_secrets(text) from public, anon, authenticated;
grant execute on function public.recovery_get_owner_household_secrets(text) to service_role;

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
declare
  v_now timestamptz := now();
  v_claim_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 22));

  update private.household_recovery_claim
  set revoked_at = v_now
  where household_id = p_household_id
    and confirmed_at is null
    and revoked_at is null;

  update private.household_recovery_secret
  set failed_attempts = 0,
      locked_until = null,
      updated_at = v_now
  where household_id = p_household_id;

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

create or replace function public.recovery_get_claim_by_token(p_token text)
returns table (
  claim_id uuid,
  household_id uuid,
  household_name text,
  previous_owner_id uuid,
  target_email text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id as claim_id,
    c.household_id,
    g.nazwa as household_name,
    c.previous_owner_id,
    c.target_email,
    c.expires_at,
    c.confirmed_at,
    c.revoked_at,
    c.created_at
  from private.household_recovery_claim c
  join public.gospodarstwo g on g.id = c.household_id
  where c.token = p_token
  limit 1;
$$;

revoke all on function public.recovery_get_claim_by_token(text) from public, anon, authenticated;
grant execute on function public.recovery_get_claim_by_token(text) to service_role;

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

  -- Usuń poprzedniego właściciela oraz ewentualne członkostwo nowego właściciela
  delete from public.czlonek_gospodarstwa
  where gospodarstwo_id = v_claim.household_id
    and user_id in (v_claim.previous_owner_id, v_household.owner_id, p_new_owner_id);

  -- Odrzuć zaległe wnioski o współadministrację po zmianie właściciela
  update public.household_admin_request
  set status = 'cancelled',
      resolved_at = v_now,
      resolved_by = p_new_owner_id
  where household_id = v_claim.household_id
    and status = 'pending';

  perform set_config('caremypet.allow_recovery_meta', '1', true);

  -- Przekazanie własności i skonsumowanie klucza (domostwo przechodzi w read-only do wygenerowania nowego klucza)
  update public.gospodarstwo
  set owner_id = p_new_owner_id,
      recovery_key_hint = null,
      recovery_key_set_at = null,
      recovery_key_set_by = null,
      recovery_email = null
  where id = v_claim.household_id;

  delete from private.household_recovery_secret
  where household_id = v_claim.household_id;

  update private.household_recovery_claim
  set confirmed_at = v_now,
      confirmed_by = p_new_owner_id
  where id = v_claim.id;

  -- Unieważnij ewentualne inne oczekujące żądania dla tego domostwa
  update private.household_recovery_claim
  set revoked_at = v_now
  where household_id = v_claim.household_id
    and id <> v_claim.id
    and confirmed_at is null
    and revoked_at is null;

  return query
  select v_household.id, v_household.nazwa, v_household.owner_id, v_claim.target_email;
end;
$$;

revoke all on function public.recovery_execute_claim(text, uuid) from public, anon, authenticated;
grant execute on function public.recovery_execute_claim(text, uuid) to service_role;

create or replace function public.auto_approve_expired_admin_requests(p_household_id uuid default null)
returns table (
  request_id uuid,
  household_id uuid,
  household_name text,
  requester_user_id uuid,
  requester_email text,
  owner_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_req record;
begin
  for v_req in
    select
      r.id as req_id,
      r.household_id as hh_id,
      g.nazwa as hh_name,
      g.owner_id as hh_owner_id,
      r.requester_user_id as req_user_id,
      r.requester_email as req_email
    from public.household_admin_request r
    join public.gospodarstwo g on g.id = r.household_id
    where r.status = 'pending'
      and r.resolves_at <= v_now
      and (p_household_id is null or r.household_id = p_household_id)
    for update of r skip locked
  loop
    update public.czlonek_gospodarstwa
    set rola = 'admin'
    where gospodarstwo_id = v_req.hh_id
      and user_id = v_req.req_user_id;

    if found then
      update public.household_admin_request
      set status = 'approved',
          resolved_at = v_now
      where id = v_req.req_id;

      request_id := v_req.req_id;
      household_id := v_req.hh_id;
      household_name := v_req.hh_name;
      requester_user_id := v_req.req_user_id;
      requester_email := v_req.req_email;
      owner_id := v_req.hh_owner_id;
      return next;
    else
      update public.household_admin_request
      set status = 'cancelled',
          resolved_at = v_now
      where id = v_req.req_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.auto_approve_expired_admin_requests(uuid) from public, anon, authenticated;
grant execute on function public.auto_approve_expired_admin_requests(uuid) to service_role;
