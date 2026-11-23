-- 1. Rozszerzenia pg_cron i pg_net do automatycznego wyzwalania powiadomień po stronie Supabase
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- 2. Tabela ustawień powiadomień e-mail dla gospodarstwa domowego
create table public.household_notification_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.gospodarstwo(id) on delete cascade,
  email_enabled boolean not null default true,
  notify_7_days_before boolean not null default true,
  notify_1_day_before boolean not null default true,
  notify_day_of boolean not null default false,
  custom_email text not null default '' check (char_length(custom_email) <= 160),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.household_notification_settings to anon;

grant select, insert, update, delete on public.household_notification_settings to authenticated;

grant select, insert, update, delete on public.household_notification_settings to service_role;

-- Włączenie RLS (Row Level Security)
alter table public.household_notification_settings enable row level security;

-- Definicja polityk RLS
create policy notification_settings_read on public.household_notification_settings
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy notification_settings_insert on public.household_notification_settings
  for insert to authenticated
  with check (household_id in (select id from public.gospodarstwo));

create policy notification_settings_update on public.household_notification_settings
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create policy notification_settings_delete on public.household_notification_settings
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 3. Tabela logów wysłanych powiadomień (ochrona przed duplikatami + historia)
create table public.schedule_notification_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  pet_id uuid references public.zwierze(id) on delete set null,
  source_kind text not null check (source_kind in ('schedule_item', 'health_event_due', 'test_digest')),
  source_id uuid not null,
  due_date date not null,
  offset_days integer not null check (offset_days in (-1, 0, 1, 7)),
  recipient_email text not null check (char_length(recipient_email) between 3 and 160),
  subject text not null check (char_length(subject) between 1 and 200),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error_message text,
  sent_at timestamptz not null default now(),
  unique (household_id, source_kind, source_id, due_date, offset_days, recipient_email)
);

create index schedule_notification_log_household_idx
  on public.schedule_notification_log (household_id, sent_at desc);

-- Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.schedule_notification_log to anon;

grant select, insert, update, delete on public.schedule_notification_log to authenticated;

grant select, insert, update, delete on public.schedule_notification_log to service_role;

-- Włączenie RLS (Row Level Security)
alter table public.schedule_notification_log enable row level security;

-- Definicja polityk RLS
create policy notification_log_read on public.schedule_notification_log
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 4. Funkcja RPC do pobierania/zapisywania ustawień powiadomień gospodarstwa
create or replace function public.save_household_notification_settings(
  p_email_enabled boolean,
  p_notify_7_days_before boolean,
  p_notify_1_day_before boolean,
  p_notify_day_of boolean,
  p_custom_email text default ''
) returns public.household_notification_settings
language plpgsql security invoker set search_path = '' as $$
declare
  v_home_id uuid;
  v_result public.household_notification_settings;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select id into v_home_id
  from public.gospodarstwo
  order by created_at asc
  limit 1;

  if v_home_id is null then
    raise exception 'Household not found' using errcode = 'P0002';
  end if;

  insert into public.household_notification_settings (
    household_id,
    email_enabled,
    notify_7_days_before,
    notify_1_day_before,
    notify_day_of,
    custom_email,
    updated_by,
    updated_at
  ) values (
    v_home_id,
    coalesce(p_email_enabled, true),
    coalesce(p_notify_7_days_before, true),
    coalesce(p_notify_1_day_before, true),
    coalesce(p_notify_day_of, false),
    btrim(coalesce(p_custom_email, '')),
    auth.uid(),
    now()
  )
  on conflict (household_id) do update set
    email_enabled = excluded.email_enabled,
    notify_7_days_before = excluded.notify_7_days_before,
    notify_1_day_before = excluded.notify_1_day_before,
    notify_day_of = excluded.notify_day_of,
    custom_email = excluded.custom_email,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end $$;

revoke all on function public.save_household_notification_settings(boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.save_household_notification_settings(boolean, boolean, boolean, boolean, text) to authenticated;

-- 5. Funkcja wewnętrzna dla service_role: zwraca odbiorców powiadomień w danym gospodarstwie
create or replace function private.get_household_notification_recipients(p_household_id uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id as user_id, u.email::text as email
  from auth.users u
  where u.email is not null
    and (
      u.id in (select g.owner_id from public.gospodarstwo g where g.id = p_household_id)
      or u.id in (select c.user_id from public.czlonek_gospodarstwa c where c.gospodarstwo_id = p_household_id)
    );
$$;

revoke all on function private.get_household_notification_recipients(uuid) from public, anon, authenticated;
grant execute on function private.get_household_notification_recipients(uuid) to service_role;

create or replace function public.get_household_notification_recipients(p_household_id uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select * from private.get_household_notification_recipients(p_household_id);
$$;

revoke all on function public.get_household_notification_recipients(uuid) from public, anon, authenticated;
grant execute on function public.get_household_notification_recipients(uuid) to service_role;

-- 6. Zadanie pg_cron: codziennie o 06:30 UTC (07:30 / 08:30 czasu polskiego) wywołuje Edge Function schedule-notifications
create or replace function private.invoke_schedule_notifications_cron()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://lrlnqmciarjvngvquchu.supabase.co/functions/v1/schedule-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "cron_dispatch"}'::jsonb
  );
end $$;

revoke all on function private.invoke_schedule_notifications_cron() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'care_my_pet_daily_schedule_notifications') then
    perform cron.unschedule('care_my_pet_daily_schedule_notifications');
  end if;
  perform cron.schedule(
    'care_my_pet_daily_schedule_notifications',
    '30 6 * * *',
    'select private.invoke_schedule_notifications_cron();'
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
