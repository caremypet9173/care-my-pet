-- Dodatkowe adresy e-mail powiadamiane przez crona dla pojedynczego terminu (maks. 5)

alter table public.pet_schedule_item
  add column if not exists notify_emails text[] not null default '{}'::text[];

alter table public.pet_schedule_item
  drop constraint if exists pet_schedule_item_notify_emails_limit;

alter table public.pet_schedule_item
  add constraint pet_schedule_item_notify_emails_limit
  check (coalesce(cardinality(notify_emails), 0) <= 5);

create or replace function public.validate_pet_schedule_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_clean text[] := '{}'::text[];
  v_raw text;
  v_email text;
begin
  if not exists (
    select 1 from public.zwierze
    where id = new.pet_id and gospodarstwo_id = new.household_id
  ) then
    raise exception 'Pet mismatch' using errcode = '42501';
  end if;

  foreach v_raw in array coalesce(new.notify_emails, '{}'::text[]) loop
    v_email := lower(btrim(coalesce(v_raw, '')));
    if v_email = '' then
      continue;
    end if;
    if char_length(v_email) > 160
       or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$' then
      raise exception 'Invalid notification email' using errcode = '22023';
    end if;
    if not (v_email = any(v_clean)) then
      if coalesce(cardinality(v_clean), 0) >= 5 then
        raise exception 'Too many notification emails (max 5)' using errcode = '22023';
      end if;
      v_clean := array_append(v_clean, v_email);
    end if;
  end loop;
  new.notify_emails := v_clean;

  if tg_op = 'UPDATE' then
    if (new.id, new.household_id, new.created_by, new.created_at)
       is distinct from (old.id, old.household_id, old.created_by, old.created_at) then
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

revoke all on function public.validate_pet_schedule_item() from public, anon, authenticated;

drop function if exists public.save_pet_schedule_item(
  uuid, uuid, integer, text, text, date, text, text, text, text, text
);

create or replace function public.save_pet_schedule_item(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_category text,
  p_title text,
  p_scheduled_date date,
  p_scheduled_time text,
  p_clinic text,
  p_doctor text,
  p_prep_notes text,
  p_status text default 'planned',
  p_notify_emails text[] default '{}'::text[]
) returns public.pet_schedule_item language plpgsql security invoker set search_path = '' as $$
declare
  result public.pet_schedule_item;
  home uuid;
  v_clean text[] := '{}'::text[];
  v_raw text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  foreach v_raw in array coalesce(p_notify_emails, '{}'::text[]) loop
    v_email := lower(btrim(coalesce(v_raw, '')));
    if v_email = '' then
      continue;
    end if;
    if char_length(v_email) > 160
       or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$' then
      raise exception 'Invalid notification email' using errcode = '22023';
    end if;
    if not (v_email = any(v_clean)) then
      if coalesce(cardinality(v_clean), 0) >= 5 then
        raise exception 'Too many notification emails (max 5)' using errcode = '22023';
      end if;
      v_clean := array_append(v_clean, v_email);
    end if;
  end loop;

  select gospodarstwo_id into strict home
  from public.zwierze
  where id = p_pet_id;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 5));

  select * into result from public.pet_schedule_item where id = p_id;

  if p_revision = 0 then
    if found then
      if result.pet_id = p_pet_id
         and result.created_by = auth.uid()
         and result.category = p_category
         and result.title = p_title
         and result.scheduled_date = p_scheduled_date
         and result.scheduled_time = p_scheduled_time
         and result.clinic = p_clinic
         and result.doctor = p_doctor
         and result.prep_notes = p_prep_notes
         and result.status = p_status
         and result.notify_emails = v_clean
         and result.revision = 1 then
        return result;
      end if;
      raise exception 'Conflicting entry' using errcode = 'PT409';
    end if;

    insert into public.pet_schedule_item (
      id,
      pet_id,
      household_id,
      category,
      title,
      scheduled_date,
      scheduled_time,
      clinic,
      doctor,
      prep_notes,
      status,
      notify_emails,
      created_by
    ) values (
      p_id,
      p_pet_id,
      home,
      p_category,
      p_title,
      p_scheduled_date,
      p_scheduled_time,
      p_clinic,
      p_doctor,
      p_prep_notes,
      p_status,
      v_clean,
      auth.uid()
    ) returning * into result;
  else
    update public.pet_schedule_item
    set pet_id = p_pet_id,
        category = p_category,
        title = p_title,
        scheduled_date = p_scheduled_date,
        scheduled_time = p_scheduled_time,
        clinic = p_clinic,
        doctor = p_doctor,
        prep_notes = p_prep_notes,
        status = p_status,
        notify_emails = v_clean
    where id = p_id and revision = p_revision
    returning * into result;

    if not found then
      raise exception 'Entry changed or unavailable' using errcode = 'PT409';
    end if;
  end if;

  return result;
end $$;

revoke all on function public.save_pet_schedule_item(uuid, uuid, integer, text, text, date, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.save_pet_schedule_item(uuid, uuid, integer, text, text, date, text, text, text, text, text, text[]) to authenticated;
