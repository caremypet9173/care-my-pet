-- ==============================================================================
-- Migracja: recovery_key_and_household_admin
-- 1. Jednorazowy Klucz odzyskania gospodarstwa + e-mail pomocniczy + twarda blokada
--    zapisów (tryb tylko do odczytu PT428) dopóki klucz nie zostanie wygenerowany.
-- 2. Zdjęcie UNIQUE(owner_id) na public.gospodarstwo (wsparcie wielu gospodarstw)
--    oraz aktywacja roli współadministratora ('admin') w czlonek_gospodarstwa.
-- 3. Publiczne wnioski przejęcia z klucza + 14-dniowy wniosek współopiekuna z wetem.
-- ==============================================================================

-- 1. Zdjęcie unikalności owner_id w public.gospodarstwo oraz dodanie pól odzyskania
do $$
declare
  v_conname text;
begin
  for v_conname in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.gospodarstwo'::regclass
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'owner_id'
  loop
    execute format('alter table public.gospodarstwo drop constraint %I', v_conname);
  end loop;
end $$;

drop index if exists public.gospodarstwo_owner_id_key;

create index if not exists gospodarstwo_owner_idx
  on public.gospodarstwo (owner_id);

alter table public.gospodarstwo
  add column if not exists recovery_email text null,
  add column if not exists recovery_key_hint text null,
  add column if not exists recovery_key_set_at timestamptz null,
  add column if not exists recovery_key_set_by uuid null references auth.users(id) on delete set null;

alter table public.gospodarstwo
  drop constraint if exists gospodarstwo_recovery_email_len,
  drop constraint if exists gospodarstwo_recovery_hint_len;

alter table public.gospodarstwo
  add constraint gospodarstwo_recovery_email_len
    check (recovery_email is null or char_length(recovery_email) between 3 and 254),
  add constraint gospodarstwo_recovery_hint_len
    check (recovery_key_hint is null or char_length(recovery_key_hint) <= 24);

-- 2. Trigger chroniący pola właścicielskie/klucza przed bezpośrednią edycją z API
create or replace function public.guard_household_recovery_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allow text := coalesce(current_setting('caremypet.allow_recovery_meta', true), '');
  v_role text := coalesce(current_setting('role', true), '');
  v_is_admin boolean := v_role in ('postgres', 'supabase_admin', 'service_role');
begin
  if not v_is_admin and v_allow <> '1' then
    if new.owner_id is distinct from old.owner_id
       or new.recovery_key_hint is distinct from old.recovery_key_hint
       or new.recovery_key_set_at is distinct from old.recovery_key_set_at
       or new.recovery_key_set_by is distinct from old.recovery_key_set_by then
      raise exception 'Recovery metadata can only be updated by server workflow' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_household_recovery_fields() from public, anon, authenticated;

drop trigger if exists guard_household_recovery_fields on public.gospodarstwo;
create trigger guard_household_recovery_fields
  before update on public.gospodarstwo
  for each row execute function public.guard_household_recovery_fields();

-- 3. Prywatne tabele kluczy i żądań odzyskania (schemat private niedostępny dla PostgREST)
create table if not exists private.household_recovery_secret (
  household_id uuid primary key references public.gospodarstwo(id) on delete cascade,
  key_hash text not null,
  key_salt text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists private.household_recovery_claim (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  previous_owner_id uuid not null references auth.users(id) on delete cascade,
  target_email text not null check (char_length(target_email) between 3 and 254),
  token text not null unique check (char_length(token) between 24 and 80),
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  confirmed_by uuid null references auth.users(id) on delete set null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists household_recovery_claim_household_idx
  on private.household_recovery_claim (household_id, created_at desc);

create table if not exists private.recovery_rate_limit (
  lookup_key text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz null,
  updated_at timestamptz not null default now()
);

grant all on private.household_recovery_secret to service_role;
grant all on private.household_recovery_claim to service_role;
grant all on private.recovery_rate_limit to service_role;

-- 4. Tabela wniosków o przejęcie administracji (14-dniowe okno weta właściciela)
create table public.household_admin_request (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null default '' check (char_length(requester_email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  resolves_at timestamptz not null default (now() + interval '14 days'),
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null
);

create unique index household_admin_request_pending_uidx
  on public.household_admin_request (household_id)
  where status = 'pending';

create index household_admin_request_household_idx
  on public.household_admin_request (household_id, requested_at desc);

-- Jawne uprawnienia API przed włączeniem RLS (AGENTS.md)
grant select on public.household_admin_request to anon;
grant select, insert, update, delete on public.household_admin_request to authenticated;
grant select, insert, update, delete on public.household_admin_request to service_role;

alter table public.household_admin_request enable row level security;

create policy household_admin_request_read on public.household_admin_request
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- 5. Funkcje pomocnicze ról administracyjnych i obecności klucza odzyskania
create or replace function public.is_household_admin(p_household_id uuid)
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
  )
  or exists (
    select 1
    from public.czlonek_gospodarstwa c
    where c.gospodarstwo_id = p_household_id
      and c.user_id = (select auth.uid())
      and c.rola = 'admin'
  );
$$;

revoke all on function public.is_household_admin(uuid) from public, anon;
grant execute on function public.is_household_admin(uuid) to authenticated, service_role;

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
  );
$$;

revoke all on function public.household_has_recovery_key(uuid) from public, anon;
grant execute on function public.household_has_recovery_key(uuid) to authenticated, service_role;

-- 6. Aktualizacja polityk RLS pod współadministratorów ('admin')
drop policy if exists household_update on public.gospodarstwo;
create policy household_update on public.gospodarstwo for update to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

drop policy if exists membership_insert on public.czlonek_gospodarstwa;
create policy membership_insert on public.czlonek_gospodarstwa for insert to authenticated
  with check (public.is_household_admin(gospodarstwo_id));

drop policy if exists membership_update on public.czlonek_gospodarstwa;
create policy membership_update on public.czlonek_gospodarstwa for update to authenticated
  using (public.is_household_admin(gospodarstwo_id));

drop policy if exists membership_delete on public.czlonek_gospodarstwa;
create policy membership_delete on public.czlonek_gospodarstwa for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_household_admin(gospodarstwo_id)
  );

drop policy if exists zaproszenie_insert on public.zaproszenie_gospodarstwa;
create policy zaproszenie_insert on public.zaproszenie_gospodarstwa for insert to authenticated
  with check (
    public.is_household_admin(gospodarstwo_id)
    and created_by = (select auth.uid())
  );

drop policy if exists zaproszenie_update on public.zaproszenie_gospodarstwa;
create policy zaproszenie_update on public.zaproszenie_gospodarstwa for update to authenticated
  using (
    public.is_household_admin(gospodarstwo_id)
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists zaproszenie_delete on public.zaproszenie_gospodarstwa;
create policy zaproszenie_delete on public.zaproszenie_gospodarstwa for delete to authenticated
  using (public.is_household_admin(gospodarstwo_id));

drop policy if exists pet_create on public.zwierze;
create policy pet_create on public.zwierze for insert to authenticated
  with check (
    public.is_household_admin(gospodarstwo_id)
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists pet_archive_link_owner_read on public.pet_archive_link;
create policy pet_archive_link_owner_read on public.pet_archive_link
  for select to authenticated
  using (public.is_household_admin(household_id));

drop policy if exists pet_archive_link_owner_update on public.pet_archive_link;
create policy pet_archive_link_owner_update on public.pet_archive_link
  for update to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

-- 7. Twarda blokada zapisu danych klinicznych/pupili w bazie bez Klucza odzyskania (PT428)
create or replace function public.enforce_household_recovery_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := tg_argv[0];
  v_household_id uuid;
  v_pet_id uuid;
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
    v_household_id := case when tg_op = 'DELETE' then old.gospodarstwo_id else new.gospodarstwo_id end;
  elsif v_kind = 'zwierze_id' then
    v_pet_id := case when tg_op = 'DELETE' then old.zwierze_id else new.zwierze_id end;
  elsif v_kind = 'pet_id' then
    v_pet_id := case when tg_op = 'DELETE' then old.pet_id else new.pet_id end;
  elsif v_kind = 'wynik_id' then
    select w.gospodarstwo_id into v_household_id
    from public.wynik_badania w
    where w.id = (case when tg_op = 'DELETE' then old.wynik_id else new.wynik_id end);
  elsif v_kind = 'measurement_id' then
    select w.gospodarstwo_id into v_household_id
    from public.pomiar_parametru p
    join public.wynik_badania w on w.id = p.wynik_id
    where p.id = (case when tg_op = 'DELETE' then old.measurement_id else new.measurement_id end);
  end if;

  if v_household_id is null and v_pet_id is not null then
    select z.gospodarstwo_id into v_household_id
    from public.zwierze z
    where z.id = v_pet_id;
  end if;

  if v_household_id is not null then
    select (g.recovery_key_set_at is not null) into v_has_key
    from public.gospodarstwo g
    where g.id = v_household_id;

    if coalesce(v_has_key, false) = false then
      raise exception 'Household recovery key is required' using errcode = 'PT428';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enforce_household_recovery_key() from public, anon, authenticated;

drop trigger if exists b_enforce_household_recovery_key on public.zwierze;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.zwierze
  for each row execute function public.enforce_household_recovery_key('household_id');

drop trigger if exists b_enforce_household_recovery_key on public.wynik_badania;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.wynik_badania
  for each row execute function public.enforce_household_recovery_key('zwierze_id');

drop trigger if exists b_enforce_household_recovery_key on public.pomiar_parametru;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pomiar_parametru
  for each row execute function public.enforce_household_recovery_key('wynik_id');

drop trigger if exists b_enforce_household_recovery_key on public.measurement_correction;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.measurement_correction
  for each row execute function public.enforce_household_recovery_key('measurement_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_weight;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_weight
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_vital_measurement;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_vital_measurement
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_fluid_therapy;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_fluid_therapy
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_health_event;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_health_event
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.medication_schedules;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.medication_schedules
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.medication_logs;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.medication_logs
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_schedule_item;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_schedule_item
  for each row execute function public.enforce_household_recovery_key('pet_id');

drop trigger if exists b_enforce_household_recovery_key on public.pet_knowledge_chunk;
create trigger b_enforce_household_recovery_key
  before insert or update or delete on public.pet_knowledge_chunk
  for each row execute function public.enforce_household_recovery_key('pet_id');

-- 8. Aktualizacja create_pet (obsługa wybranego household_id + wiele domów + wymóg klucza PT428)
drop function if exists public.create_pet(jsonb);

create or replace function public.create_pet(
  p_pet jsonb,
  p_household_id uuid default null
) returns public.zwierze
language plpgsql
security invoker
set search_path = ''
as $$
declare
  home_id uuid;
  v_has_key boolean := false;
  result public.zwierze;
  caller uuid := auth.uid();
  pet_tags text[];
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_household_id is not null then
    if not public.is_household_admin(p_household_id) then
      raise exception 'Only household owner or co-admin can add pets' using errcode = '42501';
    end if;
    home_id := p_household_id;
  else
    select g.id into home_id
    from public.gospodarstwo g
    where g.owner_id = caller
    order by g.created_at asc
    limit 1;

    if home_id is null then
      select c.gospodarstwo_id into home_id
      from public.czlonek_gospodarstwa c
      where c.user_id = caller and c.rola = 'admin'
      order by c.created_at asc
      limit 1;
    end if;

    if home_id is null then
      raise exception 'Only household owner or co-admin can add pets' using errcode = '42501';
    end if;
  end if;

  select (g.recovery_key_set_at is not null) into v_has_key
  from public.gospodarstwo g
  where g.id = home_id;

  if coalesce(v_has_key, false) = false then
    raise exception 'Household recovery key is required' using errcode = 'PT428';
  end if;

  select coalesce(array_agg(clean_tag), '{}'::text[])
  into pet_tags
  from (
    select btrim(elem) as clean_tag
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(p_pet->'tagi') = 'array' then p_pet->'tagi'
        else '[]'::jsonb
      end
    ) as t(elem)
    where btrim(elem) <> ''
  ) normalized;

  insert into public.zwierze(
    gospodarstwo_id, imie, gatunek, rasa, data_urodzenia, plec,
    kastracja, identyfikacja, numer_id, notatki, tagi,
    created_by, updated_by, data_urodzenia_przyblizona, avatar_path
  )
  values (
    home_id, p_pet->>'imie', p_pet->>'gatunek', p_pet->>'rasa',
    (p_pet->>'data_urodzenia')::date, p_pet->>'plec', (p_pet->>'kastracja')::boolean,
    p_pet->>'identyfikacja', p_pet->>'numer_id', p_pet->>'notatki', pet_tags,
    caller, caller,
    coalesce((p_pet->>'data_urodzenia_przyblizona')::boolean, false), p_pet->>'avatar_path'
  )
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_pet(jsonb, uuid) from public, anon;
grant execute on function public.create_pet(jsonb, uuid) to authenticated;

-- 9. Aktualizacja archive_pet i restore_pet: uprawnienie is_household_admin + wymóg klucza PT428
create or replace function public.archive_pet(
  p_pet_id uuid,
  p_reason text,
  p_closed_on date default null,
  p_note text default null
)
returns public.zwierze
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  v_pet public.zwierze;
  v_has_key boolean := false;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_closed_on date := p_closed_on;
  v_max_date date := greatest(current_date, (now() at time zone 'Europe/Warsaw')::date);
  result public.zwierze;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_reason not in ('deceased', 'rehomed', 'other') then
    raise exception 'Invalid archive reason' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Archive note too long' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_pet_id::text, 11));

  select * into v_pet
  from public.zwierze
  where id = p_pet_id;

  if not found then
    raise exception 'Pet not found' using errcode = 'P0002';
  end if;

  if not public.is_household_admin(v_pet.gospodarstwo_id) then
    raise exception 'Only household owner or co-admin can archive pet records' using errcode = '42501';
  end if;

  select (g.recovery_key_set_at is not null) into v_has_key
  from public.gospodarstwo g
  where g.id = v_pet.gospodarstwo_id;

  if coalesce(v_has_key, false) = false then
    raise exception 'Household recovery key is required' using errcode = 'PT428';
  end if;

  if v_pet.archived_at is not null then
    raise exception 'Pet record is already archived' using errcode = 'PT409';
  end if;

  if v_reason <> 'deceased' then
    v_closed_on := null;
  elsif v_closed_on is not null then
    if v_closed_on < date '1900-01-01' or v_closed_on > v_max_date then
      raise exception 'Invalid departure date' using errcode = '22023';
    end if;
    if v_pet.data_urodzenia is not null and v_closed_on < v_pet.data_urodzenia then
      raise exception 'Departure date cannot precede birth date' using errcode = '22023';
    end if;
  end if;

  perform set_config('caremypet.allow_pet_archive_transition', '1', true);

  update public.medication_schedules
  set is_active = false
  where pet_id = p_pet_id
    and is_active = true;

  update public.pet_schedule_item
  set status = 'cancelled'
  where pet_id = p_pet_id
    and status = 'planned';

  update public.pet_share_link
  set revoked_at = now()
  where pet_id = p_pet_id
    and revoked_at is null;

  update public.zwierze
  set archived_at = now(),
      archived_by = caller,
      archive_reason = v_reason,
      closed_on = v_closed_on,
      archive_note = v_note
  where id = p_pet_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.restore_pet(p_pet_id uuid)
returns public.zwierze
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  v_pet public.zwierze;
  v_has_key boolean := false;
  result public.zwierze;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_pet_id::text, 11));

  select * into v_pet
  from public.zwierze
  where id = p_pet_id;

  if not found then
    raise exception 'Pet not found' using errcode = 'P0002';
  end if;

  if not public.is_household_admin(v_pet.gospodarstwo_id) then
    raise exception 'Only household owner or co-admin can restore pet records' using errcode = '42501';
  end if;

  select (g.recovery_key_set_at is not null) into v_has_key
  from public.gospodarstwo g
  where g.id = v_pet.gospodarstwo_id;

  if coalesce(v_has_key, false) = false then
    raise exception 'Household recovery key is required' using errcode = 'PT428';
  end if;

  if v_pet.archived_at is null then
    raise exception 'Pet record is not archived' using errcode = 'PT409';
  end if;

  perform set_config('caremypet.allow_pet_archive_transition', '1', true);

  update public.zwierze
  set archived_at = null,
      archived_by = null,
      archive_reason = null,
      closed_on = null,
      archive_note = null
  where id = p_pet_id
  returning * into result;

  return result;
end;
$$;

-- 10. Rozszerzenie check_pilot_access o aktywne żądania odzyskania dostępu
create or replace function public.check_pilot_access(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text := lower(btrim(p_email));
  v_is_whitelisted boolean := false;
  v_has_invitation boolean := false;
  v_has_recovery boolean := false;
  v_has_account boolean := false;
begin
  if v_norm is null or v_norm = '' or v_norm !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return jsonb_build_object('eligible', false, 'reason', 'invalid_email');
  end if;

  select exists(select 1 from public.pilot_whitelist where lower(email) = v_norm) into v_is_whitelisted;
  select exists(select 1 from public.zaproszenie_gospodarstwa where lower(email) = v_norm and status in ('pending', 'accepted')) into v_has_invitation;
  select exists(
    select 1
    from private.household_recovery_claim
    where lower(target_email) = v_norm
      and confirmed_at is null
      and revoked_at is null
      and expires_at > now()
  ) into v_has_recovery;
  select exists(select 1 from auth.users where lower(email) = v_norm) into v_has_account;

  if v_is_whitelisted or v_has_invitation or v_has_recovery or v_has_account then
    return jsonb_build_object(
      'eligible', true,
      'has_account', v_has_account,
      'is_invitation', (v_has_invitation or v_has_recovery) and not v_is_whitelisted
    );
  else
    return jsonb_build_object(
      'eligible', false,
      'reason', 'not_whitelisted'
    );
  end if;
end;
$$;
