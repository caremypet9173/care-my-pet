-- ==============================================================================
-- Migracja: pet_archiving
-- Odwracalne zamykanie (archiwizacja) i przywracanie kartoteki pupila
-- wraz z ochroną przed mutacją archiwalnych danych klinicznych.
-- ==============================================================================

-- 1. Kolumny archiwizacji w tabeli public.zwierze
alter table public.zwierze
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references auth.users(id) on delete set null,
  add column if not exists archive_reason text null,
  add column if not exists closed_on date null,
  add column if not exists archive_note text null;

alter table public.zwierze
  drop constraint if exists zwierze_archive_reason_check,
  drop constraint if exists zwierze_archive_note_length,
  drop constraint if exists zwierze_archive_consistency,
  drop constraint if exists zwierze_closed_on_deceased,
  drop constraint if exists zwierze_closed_on_range;

alter table public.zwierze
  add constraint zwierze_archive_reason_check
    check (archive_reason is null or archive_reason in ('deceased', 'rehomed', 'other')),
  add constraint zwierze_archive_note_length
    check (archive_note is null or char_length(archive_note) <= 1000),
  add constraint zwierze_archive_consistency
    check (
      (archived_at is null and archived_by is null and archive_reason is null and closed_on is null and archive_note is null)
      or (archived_at is not null and archive_reason is not null)
    ),
  add constraint zwierze_closed_on_deceased
    check (closed_on is null or archive_reason = 'deceased'),
  add constraint zwierze_closed_on_range
    check (
      closed_on is null
      or (
        closed_on >= date '1900-01-01'
        and closed_on <= (current_date + 1)
        and (data_urodzenia is null or closed_on >= data_urodzenia)
      )
    );

create index if not exists zwierze_active_idx
  on public.zwierze (gospodarstwo_id)
  where archived_at is null;

-- 2. Ochrona wiersza public.zwierze przed bezpośrednią zmianą pól archiwizacji lub edycją zamkniętej kartoteki
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

  return new;
end;
$$;

revoke all on function public.guard_archived_pet_update() from public, anon, authenticated;

drop trigger if exists guard_archived_pet_update on public.zwierze;
create trigger guard_archived_pet_update
  before update on public.zwierze
  for each row execute function public.guard_archived_pet_update();

-- 3. Wspólna funkcja triggerowa blokująca mutacje danych powiązanych z zarchiwizowaną kartoteką
create or replace function public.reject_archived_pet_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := tg_argv[0];
  v_pet_id uuid;
  v_archived_at timestamptz;
  v_role text := coalesce(current_setting('role', true), '');
begin
  if coalesce(current_setting('caremypet.allow_pet_archive_transition', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Kaskadowe usuwanie przez mechanizmy wewnętrzne DB bez aktywnej sesji użytkownika
  if tg_op = 'DELETE' and auth.uid() is null and v_role in ('postgres', 'supabase_admin') then
    return old;
  end if;

  if v_kind = 'zwierze_id' then
    v_pet_id := case when tg_op = 'DELETE' then old.zwierze_id else new.zwierze_id end;
  elsif v_kind = 'pet_id' then
    v_pet_id := case when tg_op = 'DELETE' then old.pet_id else new.pet_id end;
  elsif v_kind = 'wynik_id' then
    select w.zwierze_id into v_pet_id
    from public.wynik_badania w
    where w.id = (case when tg_op = 'DELETE' then old.wynik_id else new.wynik_id end);
  elsif v_kind = 'measurement_id' then
    select w.zwierze_id into v_pet_id
    from public.pomiar_parametru p
    join public.wynik_badania w on w.id = p.wynik_id
    where p.id = (case when tg_op = 'DELETE' then old.measurement_id else new.measurement_id end);
  end if;

  if v_pet_id is not null then
    select z.archived_at into v_archived_at
    from public.zwierze z
    where z.id = v_pet_id;

    if v_archived_at is not null then
      raise exception 'Pet record is archived' using errcode = 'PT423';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_archived_pet_mutation() from public, anon, authenticated;

drop trigger if exists a_reject_archived_pet_mutation on public.wynik_badania;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.wynik_badania
  for each row execute function public.reject_archived_pet_mutation('zwierze_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pomiar_parametru;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pomiar_parametru
  for each row execute function public.reject_archived_pet_mutation('wynik_id');

drop trigger if exists a_reject_archived_pet_mutation on public.measurement_correction;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.measurement_correction
  for each row execute function public.reject_archived_pet_mutation('measurement_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_weight;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_weight
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_vital_measurement;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_vital_measurement
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_fluid_therapy;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_fluid_therapy
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_health_event;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_health_event
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.medication_schedules;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.medication_schedules
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.medication_logs;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.medication_logs
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_schedule_item;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_schedule_item
  for each row execute function public.reject_archived_pet_mutation('pet_id');

drop trigger if exists a_reject_archived_pet_mutation on public.pet_knowledge_chunk;
create trigger a_reject_archived_pet_mutation
  before insert or update or delete on public.pet_knowledge_chunk
  for each row execute function public.reject_archived_pet_mutation('pet_id');

-- 4. RPC: zamknięcie (archiwizacja) kartoteki — wyłącznie właściciel gospodarstwa
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

  if not exists (
    select 1
    from public.gospodarstwo g
    where g.id = v_pet.gospodarstwo_id
      and g.owner_id = caller
  ) then
    raise exception 'Only household owner can archive pet records' using errcode = '42501';
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

  -- Wycisz aktywne harmonogramy leków, zaplanowane wizyty oraz aktywne linki udostępniania
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

revoke all on function public.archive_pet(uuid, text, date, text) from public, anon;
grant execute on function public.archive_pet(uuid, text, date, text) to authenticated, service_role;

-- 5. RPC: przywrócenie zamkniętej kartoteki — wyłącznie właściciel gospodarstwa
create or replace function public.restore_pet(p_pet_id uuid)
returns public.zwierze
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  v_pet public.zwierze;
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

  if not exists (
    select 1
    from public.gospodarstwo g
    where g.id = v_pet.gospodarstwo_id
      and g.owner_id = caller
  ) then
    raise exception 'Only household owner can restore pet records' using errcode = '42501';
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

revoke all on function public.restore_pet(uuid) from public, anon;
grant execute on function public.restore_pet(uuid) to authenticated, service_role;
