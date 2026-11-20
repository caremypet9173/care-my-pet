-- ============================================================================
-- First-party pilot telemetry (zero cookies, zero third-party trackers, 90d TTL)
-- Stores normalized route/tab/action/flow/error metadata only — never PII text
-- or medical contents. Stored in `private` schema; written via strict RPC.
-- ============================================================================

create table private.pilot_telemetry_event (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in ('page_view', 'tab_view', 'action', 'flow', 'client_error')
  ),
  route_template text not null check (char_length(route_template) between 1 and 120),
  name text not null check (char_length(name) between 1 and 80),
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  device_class text not null default 'desktop' check (
    device_class in ('mobile', 'tablet', 'desktop')
  ),
  is_pwa boolean not null default false,
  meta jsonb not null default '{}'::jsonb check (
    jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 512
  )
);

create index pilot_telemetry_event_created_idx
  on private.pilot_telemetry_event (created_at desc);

create index pilot_telemetry_event_type_name_idx
  on private.pilot_telemetry_event (event_type, name, created_at desc);

create index pilot_telemetry_event_user_idx
  on private.pilot_telemetry_event (user_id, created_at desc);

alter table private.pilot_telemetry_event enable row level security;
revoke all on private.pilot_telemetry_event from public, anon, authenticated;
grant select, insert, delete on private.pilot_telemetry_event to service_role;
grant usage, select on sequence private.pilot_telemetry_event_id_seq to service_role;

-- Batched insert RPC for authenticated users (max 20 events/call, 500/10min/user)
create or replace function public.log_pilot_telemetry_batch(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_recent_count integer := 0;
  v_item jsonb;
  v_event_type text;
  v_route text;
  v_name text;
  v_locale text;
  v_device text;
  v_is_pwa boolean;
  v_meta jsonb;
  v_inserted integer := 0;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    return 0;
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;

  -- Safety valve against runaway client loops or spam
  select count(*)::integer
  into v_recent_count
  from private.pilot_telemetry_event e
  where e.user_id = v_uid
    and e.created_at >= now() - interval '10 minutes';

  if v_recent_count >= 500 then
    return 0;
  end if;

  for v_item in
    select elem
    from jsonb_array_elements(p_events) as elem
    limit 20
  loop
    if jsonb_typeof(v_item) <> 'object' then
      continue;
    end if;

    v_event_type := coalesce(v_item->>'event_type', '');
    if v_event_type not in ('page_view', 'tab_view', 'action', 'flow', 'client_error') then
      continue;
    end if;

    v_route := left(btrim(coalesce(v_item->>'route_template', '')), 120);
    if v_route = '' or left(v_route, 1) <> '/' then
      continue;
    end if;

    v_name := left(lower(btrim(coalesce(v_item->>'name', ''))), 80);
    if v_name = '' or v_name !~ '^[a-z0-9_.:/-]+$' then
      continue;
    end if;

    v_locale := case when v_item->>'locale' = 'en' then 'en' else 'pl' end;
    v_device := case
      when v_item->>'device_class' in ('mobile', 'tablet', 'desktop') then v_item->>'device_class'
      else 'desktop'
    end;
    v_is_pwa := coalesce((v_item->>'is_pwa')::boolean, false);

    if jsonb_typeof(v_item->'meta') = 'object'
       and octet_length((v_item->'meta')::text) <= 512 then
      v_meta := v_item->'meta';
    else
      v_meta := '{}'::jsonb;
    end if;

    insert into private.pilot_telemetry_event (
      user_id,
      event_type,
      route_template,
      name,
      locale,
      device_class,
      is_pwa,
      meta
    ) values (
      v_uid,
      v_event_type,
      v_route,
      v_name,
      v_locale,
      v_device,
      v_is_pwa,
      v_meta
    );

    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.log_pilot_telemetry_batch(jsonb) from public, anon;
grant execute on function public.log_pilot_telemetry_batch(jsonb) to authenticated, service_role;

-- 90-day retention cleanup (matches privacy policy §3)
create or replace function private.purge_expired_pilot_telemetry()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  delete from private.pilot_telemetry_event
  where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_expired_pilot_telemetry() from public, anon, authenticated;
grant execute on function private.purge_expired_pilot_telemetry() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'care_my_pet_daily_telemetry_purge') then
    perform cron.unschedule('care_my_pet_daily_telemetry_purge');
  end if;
  perform cron.schedule(
    'care_my_pet_daily_telemetry_purge',
    '15 3 * * *',
    'select private.purge_expired_pilot_telemetry();'
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;

-- ============================================================================
-- Admin reporting views (private schema only, never exposed to Data API)
-- ============================================================================

create or replace view private.pilot_telemetry_feature_summary
with (security_invoker = true) as
select
  event_type,
  name,
  route_template,
  count(*) as total_events,
  count(distinct user_id) as unique_users,
  count(*) filter (where device_class = 'mobile') as mobile_events,
  count(*) filter (where is_pwa) as pwa_events,
  max(created_at) as last_seen_at
from private.pilot_telemetry_event
where created_at >= now() - interval '30 days'
group by 1, 2, 3
order by total_events desc, last_seen_at desc;

create or replace view private.pilot_telemetry_device_summary
with (security_invoker = true) as
select
  device_class,
  is_pwa,
  count(distinct user_id) as unique_users,
  count(*) filter (where event_type = 'page_view') as page_views,
  count(*) as total_events,
  max(created_at) as last_seen_at
from private.pilot_telemetry_event
where created_at >= now() - interval '30 days'
group by 1, 2
order by total_events desc;

create or replace view private.pilot_telemetry_recent_errors
with (security_invoker = true) as
select
  created_at,
  user_id,
  route_template,
  name,
  locale,
  device_class,
  is_pwa,
  meta
from private.pilot_telemetry_event
where event_type = 'client_error'
  and created_at >= now() - interval '14 days'
order by created_at desc
limit 200;

create or replace view private.pilot_telemetry_user_activity
with (security_invoker = true) as
select
  e.user_id,
  u.email,
  count(distinct (e.created_at at time zone 'Europe/Warsaw')::date) as active_days,
  count(*) filter (where e.event_type = 'page_view') as page_views,
  count(*) filter (where e.event_type = 'tab_view') as tab_views,
  count(*) filter (where e.event_type in ('action', 'flow')) as actions_and_flows,
  count(*) filter (where e.event_type = 'client_error') as client_errors,
  bool_or(e.is_pwa) as uses_pwa,
  max(e.created_at) as last_seen_at
from private.pilot_telemetry_event e
left join auth.users u on u.id = e.user_id
where e.created_at >= now() - interval '30 days'
group by 1, 2
order by last_seen_at desc;

revoke all on private.pilot_telemetry_feature_summary from public, anon, authenticated;
revoke all on private.pilot_telemetry_device_summary from public, anon, authenticated;
revoke all on private.pilot_telemetry_recent_errors from public, anon, authenticated;
revoke all on private.pilot_telemetry_user_activity from public, anon, authenticated;

grant select on private.pilot_telemetry_feature_summary to service_role;
grant select on private.pilot_telemetry_device_summary to service_role;
grant select on private.pilot_telemetry_recent_errors to service_role;
grant select on private.pilot_telemetry_user_activity to service_role;
