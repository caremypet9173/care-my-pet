-- ==============================================================================
-- Migracja: perf_indexes_and_rls_cleanup (Pakiet 3)
-- 1. P1.13: Bezparametrowe funkcje helperowe RLS (get_user_owner_household_ids,
--    get_user_admin_household_ids) i przepisanie 15 polityk RLS z per-row na
--    InitPlan-cacheable podzapytania (zachowując w 100% Opcję A: owner/admin)
-- 2. P0.15 / P1.14: Indeksy częściowe pod crona (schedule-notifications,
--    auto_approve_expired_admin_requests) + brakujące indeksy FK i złożone
--    pod ORDER BY dla 9 tabel
-- 3. P2: Usunięcie 3 zduplikowanych indeksów B-tree pokrywających się z UNIQUE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Bezparametrowe helpery RLS (InitPlan zamiast wywołań per-wiersz)
-- ------------------------------------------------------------------------------
create or replace function public.get_user_owner_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.gospodarstwo g
  where g.owner_id = (select auth.uid());
$$;

revoke all on function public.get_user_owner_household_ids() from public, anon;
grant execute on function public.get_user_owner_household_ids() to authenticated, service_role;

create or replace function public.get_user_admin_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.gospodarstwo g
  where g.owner_id = (select auth.uid())
  union
  select c.gospodarstwo_id
  from public.czlonek_gospodarstwa c
  where c.user_id = (select auth.uid())
    and c.rola = 'admin';
$$;

revoke all on function public.get_user_admin_household_ids() from public, anon;
grant execute on function public.get_user_admin_household_ids() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Przepisanie pominiętych polityk RLS na helpery bezparametrowe
-- ------------------------------------------------------------------------------

-- household_notification_settings
drop policy if exists notification_settings_read on public.household_notification_settings;
create policy notification_settings_read on public.household_notification_settings
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists notification_settings_insert on public.household_notification_settings;
create policy notification_settings_insert on public.household_notification_settings
  for insert to authenticated
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists notification_settings_update on public.household_notification_settings;
create policy notification_settings_update on public.household_notification_settings
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists notification_settings_delete on public.household_notification_settings;
create policy notification_settings_delete on public.household_notification_settings
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- schedule_notification_log
drop policy if exists notification_log_read on public.schedule_notification_log;
create policy notification_log_read on public.schedule_notification_log
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- medication_logs / medication_schedules INSERT
drop policy if exists medication_logs_insert on public.medication_logs;
create policy medication_logs_insert on public.medication_logs
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

drop policy if exists medication_schedules_insert on public.medication_schedules;
create policy medication_schedules_insert on public.medication_schedules
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

-- gospodarstwo UPDATE (owner lub admin)
drop policy if exists household_update on public.gospodarstwo;
create policy household_update on public.gospodarstwo
  for update to authenticated
  using (id in (select public.get_user_admin_household_ids()))
  with check (id in (select public.get_user_admin_household_ids()));

-- pet_archive_link SELECT (owner lub admin)
drop policy if exists pet_archive_link_owner_read on public.pet_archive_link;
create policy pet_archive_link_owner_read on public.pet_archive_link
  for select to authenticated
  using (household_id in (select public.get_user_admin_household_ids()));

-- zwierze INSERT (owner lub admin)
drop policy if exists pet_create on public.zwierze;
create policy pet_create on public.zwierze
  for insert to authenticated
  with check (
    gospodarstwo_id in (select public.get_user_admin_household_ids())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- czlonek_gospodarstwa INSERT / DELETE (Opcja A: owner wszystko, admin tylko member)
drop policy if exists membership_insert on public.czlonek_gospodarstwa;
create policy membership_insert on public.czlonek_gospodarstwa
  for insert to authenticated
  with check (
    gospodarstwo_id in (select public.get_user_owner_household_ids())
    or (
      gospodarstwo_id in (select public.get_user_admin_household_ids())
      and rola = 'member'
    )
  );

drop policy if exists membership_delete on public.czlonek_gospodarstwa;
create policy membership_delete on public.czlonek_gospodarstwa
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or gospodarstwo_id in (select public.get_user_owner_household_ids())
    or (
      gospodarstwo_id in (select public.get_user_admin_household_ids())
      and rola = 'member'
    )
  );

-- zaproszenie_gospodarstwa INSERT / UPDATE / DELETE (Opcja A)
drop policy if exists zaproszenie_insert on public.zaproszenie_gospodarstwa;
create policy zaproszenie_insert on public.zaproszenie_gospodarstwa
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      gospodarstwo_id in (select public.get_user_owner_household_ids())
      or (
        gospodarstwo_id in (select public.get_user_admin_household_ids())
        and rola = 'member'
      )
    )
  );

drop policy if exists zaproszenie_update on public.zaproszenie_gospodarstwa;
create policy zaproszenie_update on public.zaproszenie_gospodarstwa
  for update to authenticated
  using (
    gospodarstwo_id in (select public.get_user_owner_household_ids())
    or (
      gospodarstwo_id in (select public.get_user_admin_household_ids())
      and rola = 'member'
    )
  )
  with check (
    gospodarstwo_id in (select public.get_user_owner_household_ids())
    or (
      gospodarstwo_id in (select public.get_user_admin_household_ids())
      and rola = 'member'
    )
  );

drop policy if exists zaproszenie_delete on public.zaproszenie_gospodarstwa;
create policy zaproszenie_delete on public.zaproszenie_gospodarstwa
  for delete to authenticated
  using (
    gospodarstwo_id in (select public.get_user_owner_household_ids())
    or (
      gospodarstwo_id in (select public.get_user_admin_household_ids())
      and rola = 'member'
    )
  );

-- ------------------------------------------------------------------------------
-- 3. Indeksy częściowe pod crona i brakujące indeksy FK / złożone pod ORDER BY
-- ------------------------------------------------------------------------------
create index if not exists pet_health_event_next_due_date_idx
  on public.pet_health_event (next_due_date)
  where next_due_date is not null;

create index if not exists pet_schedule_item_planned_date_idx
  on public.pet_schedule_item (scheduled_date)
  where status = 'planned';

create index if not exists household_admin_request_pending_resolves_idx
  on public.household_admin_request (resolves_at)
  where status = 'pending';

create index if not exists pet_share_link_household_idx
  on public.pet_share_link (household_id);

create index if not exists pet_share_open_log_household_idx
  on public.pet_share_open_log (household_id);

create index if not exists pet_schedule_item_completed_event_idx
  on public.pet_schedule_item (completed_event_id)
  where completed_event_id is not null;

create index if not exists pet_schedule_item_household_order_idx
  on public.pet_schedule_item (household_id, scheduled_date asc, created_at desc);

create index if not exists wynik_badania_household_date_idx
  on public.wynik_badania (gospodarstwo_id, test_date desc, confirmed_at desc);

create index if not exists pet_health_event_household_date_idx
  on public.pet_health_event (household_id, event_date desc, created_at desc);

create index if not exists pet_vital_measurement_pet_date_time_idx
  on public.pet_vital_measurement (pet_id, measured_on desc, measured_at desc);

create index if not exists pet_fluid_therapy_pet_date_time_idx
  on public.pet_fluid_therapy (pet_id, administered_on desc, administered_at desc);

create index if not exists medication_logs_pet_date_admin_idx
  on public.medication_logs (pet_id, dose_date desc, administered_at desc);

create index if not exists medication_logs_household_date_admin_idx
  on public.medication_logs (household_id, dose_date desc, administered_at desc);

-- ------------------------------------------------------------------------------
-- 4. Usunięcie 3 zduplikowanych indeksów B-tree
-- ------------------------------------------------------------------------------
drop index if exists public.pet_share_link_token_idx;
drop index if exists public.zaproszenie_token_idx;
drop index if exists public.idx_push_user;
