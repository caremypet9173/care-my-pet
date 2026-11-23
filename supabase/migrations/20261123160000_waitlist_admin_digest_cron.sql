-- Godzinowy digest e-mail dla administratora o nowych zgłoszeniach na public.waitlist
-- Wysyła powiadomienie przez Edge Function schedule-notifications wyłącznie wtedy,
-- gdy istnieją zgłoszenia ze statusem 'pending' i admin_notified_at IS NULL.

-- 1. Kolumna śledząca wysłanie powiadomienia do administratora
alter table public.waitlist
  add column if not exists admin_notified_at timestamptz;

-- Już rozpatrzone zgłoszenia (invited / rejected) traktujemy jako znane administratorowi;
-- istniejące zgłoszenia 'pending' celowo zostają z admin_notified_at = null,
-- aby zostały uwzględnione w pierwszym raporcie o pełnej godzinie.
update public.waitlist
set admin_notified_at = coalesce(admin_notified_at, now())
where status <> 'pending'
  and admin_notified_at is null;

-- 2. Indeks częściowy dla szybkiego sprawdzania niepowiadomionych zgłoszeń pending
create index if not exists waitlist_unnotified_pending_idx
  on public.waitlist (created_at asc)
  where status = 'pending' and admin_notified_at is null;

-- 3. Funkcja pg_cron: wywołuje schedule-notifications (action: waitlist_digest)
--    wyłącznie gdy w public.waitlist czekają nowe niepowiadomione zgłoszenia pending.
create or replace function private.invoke_waitlist_digest_cron()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if not exists (
    select 1
    from public.waitlist
    where status = 'pending'
      and admin_notified_at is null
  ) then
    return;
  end if;

  select s.secret into v_secret
  from private.cron_dispatch_secret s
  where s.id = 1;

  perform net.http_post(
    url := 'https://lrlnqmciarjvngvquchu.supabase.co/functions/v1/schedule-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := '{"action": "waitlist_digest"}'::jsonb
  );
end;
$$;

revoke all on function private.invoke_waitlist_digest_cron() from public, anon, authenticated;

-- 4. Zadanie pg_cron: co godzinę o pełnej godzinie (0 * * * * UTC == pełna godzina w Europe/Warsaw)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'care_my_pet_hourly_waitlist_digest') then
    perform cron.unschedule('care_my_pet_hourly_waitlist_digest');
  end if;
  perform cron.schedule(
    'care_my_pet_hourly_waitlist_digest',
    '0 * * * *',
    'select private.invoke_waitlist_digest_cron();'
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
