-- ============================================================================
-- Migracja #63: System zgłaszania sugestii i błędów podczas pilotażu
-- (public.pilot_feedback + prywatny bucket pilot-feedback + retencja 90 dni)
-- ============================================================================

-- 1. Tabela public.pilot_feedback
create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reporter_email text not null default '' check (char_length(reporter_email) <= 180),
  category text not null check (category in ('bug', 'suggestion', 'ux')),
  message text not null check (char_length(btrim(message)) between 3 and 4000),
  route_template text not null default '/' check (char_length(route_template) <= 160),
  active_tab text not null default '' check (char_length(active_tab) <= 40),
  locale text not null default 'pl' check (locale in ('pl', 'en')),
  device_class text not null default 'desktop' check (device_class in ('mobile', 'tablet', 'desktop')),
  is_pwa boolean not null default false,
  viewport text not null default '' check (char_length(viewport) <= 32),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  breadcrumbs jsonb not null default '[]'::jsonb check (
    jsonb_typeof(breadcrumbs) = 'array' and pg_column_size(breadcrumbs) <= 4096
  ),
  recent_errors jsonb not null default '[]'::jsonb check (
    jsonb_typeof(recent_errors) = 'array' and pg_column_size(recent_errors) <= 4096
  ),
  screenshot_path text check (
    screenshot_path is null
    or screenshot_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
  ),
  screenshot_mime text check (
    screenshot_mime is null
    or screenshot_mime in ('image/webp', 'image/jpeg', 'image/png')
  ),
  status text not null default 'new' check (
    status in ('new', 'triaged', 'planned', 'resolved', 'wontfix')
  ),
  triage_notes text not null default '' check (char_length(triage_notes) <= 4000),
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_feedback_user_created_idx
  on public.pilot_feedback (user_id, created_at desc);

create index if not exists pilot_feedback_status_created_idx
  on public.pilot_feedback (status, created_at desc);

create index if not exists pilot_feedback_created_idx
  on public.pilot_feedback (created_at);

-- 2. Jawne nadanie uprawnień dla API (obowiązkowe dla każdej nowej tabeli public)
grant select on public.pilot_feedback to anon;
grant select, insert, update, delete on public.pilot_feedback to authenticated;
grant select, insert, update, delete on public.pilot_feedback to service_role;

-- 3. Włączenie RLS
alter table public.pilot_feedback enable row level security;

-- 4. Polityki RLS: użytkownik widzi i dodaje wyłącznie własne zgłoszenia (brak UPDATE/DELETE dla authenticated)
drop policy if exists pilot_feedback_read_own on public.pilot_feedback;
create policy pilot_feedback_read_own
  on public.pilot_feedback
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists pilot_feedback_insert_own on public.pilot_feedback;
create policy pilot_feedback_insert_own
  on public.pilot_feedback
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new'
    and triage_notes = ''
    and triaged_at is null
  );

-- 5. Trigger walidujący i ograniczający spam (maks. 10 zgłoszeń / 24h / user)
create or replace function public.guard_pilot_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(current_setting('role', true), '');
  v_recent_count integer := 0;
begin
  if v_role in ('postgres', 'supabase_admin', 'service_role') and v_uid is null then
    return new;
  end if;

  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  new.user_id := v_uid;
  new.reporter_email := left(coalesce(auth.jwt()->>'email', ''), 180);
  new.status := 'new';
  new.triage_notes := '';
  new.triaged_at := null;
  new.created_at := now();
  new.updated_at := now();

  if new.screenshot_path is not null then
    if split_part(new.screenshot_path, '/', 1) <> v_uid::text then
      raise exception 'Invalid screenshot ownership' using errcode = '42501';
    end if;
    if new.screenshot_mime is null then
      raise exception 'Screenshot MIME required' using errcode = '22023';
    end if;
  else
    new.screenshot_mime := null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pilot_feedback:' || v_uid::text, 7));

  select count(*)::int
  into v_recent_count
  from public.pilot_feedback f
  where f.user_id = v_uid
    and f.created_at >= now() - interval '24 hours';

  if v_recent_count >= 10 then
    raise exception 'Daily feedback limit reached' using errcode = 'PT429';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_pilot_feedback_insert() from public, anon, authenticated;

drop trigger if exists a_guard_pilot_feedback_insert on public.pilot_feedback;
create trigger a_guard_pilot_feedback_insert
  before insert on public.pilot_feedback
  for each row execute function public.guard_pilot_feedback_insert();

-- 6. Prywatny bucket Supabase Storage na opcjonalne zrzuty ekranu (maks. 2 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pilot-feedback',
  'pilot-feedback',
  false,
  2097152,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pilot_feedback_screenshot_upload on storage.objects;
create policy pilot_feedback_screenshot_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pilot-feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
  );

drop policy if exists pilot_feedback_screenshot_read_own on storage.objects;
create policy pilot_feedback_screenshot_read_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pilot-feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists pilot_feedback_screenshot_cleanup_own on storage.objects;
create policy pilot_feedback_screenshot_cleanup_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pilot-feedback'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.pilot_feedback f
      where f.screenshot_path = storage.objects.name
    )
  );

-- 7. Widok administracyjny w schemacie private + retencja 90 dni (pg_cron)
create or replace view private.pilot_feedback_summary
with (security_invoker = true) as
select
  status,
  category,
  route_template,
  count(*) as total_items,
  count(*) filter (where screenshot_path is not null) as with_screenshot,
  max(created_at) as last_reported_at
from public.pilot_feedback
group by 1, 2, 3
order by
  case status
    when 'new' then 1
    when 'triaged' then 2
    when 'planned' then 3
    when 'resolved' then 4
    else 5
  end,
  last_reported_at desc;

revoke all on private.pilot_feedback_summary from public, anon, authenticated;
grant select on private.pilot_feedback_summary to service_role;

create or replace function private.purge_expired_pilot_feedback()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.pilot_feedback
  where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_expired_pilot_feedback() from public, anon, authenticated;
grant execute on function private.purge_expired_pilot_feedback() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'care_my_pet_daily_feedback_purge') then
    perform cron.unschedule('care_my_pet_daily_feedback_purge');
  end if;
  perform cron.schedule(
    'care_my_pet_daily_feedback_purge',
    '45 3 * * *',
    'select private.purge_expired_pilot_feedback();'
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
