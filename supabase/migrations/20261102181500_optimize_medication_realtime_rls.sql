-- ==============================================================================
-- Migracja: optimize_medication_realtime_rls
-- Optymalizacja polityk RLS pod kątem silnika Supabase Realtime (CDC / wal2json).
-- Bezpośrednie użycie security definer public.get_user_household_ids() zamiast
-- zagnieżdżonego podzapytania (select id from public.gospodarstwo), co eliminuje
-- problemy z odrzucaniem zdarzeń Realtime pomiędzy członkami gospodarstwa.
-- ==============================================================================

-- 1. Aktualizacja polityk RLS dla public.medication_schedules
drop policy if exists medication_schedules_read on public.medication_schedules;
create policy medication_schedules_read on public.medication_schedules
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists medication_schedules_update on public.medication_schedules;
create policy medication_schedules_update on public.medication_schedules
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists medication_schedules_delete on public.medication_schedules;
create policy medication_schedules_delete on public.medication_schedules
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- 2. Aktualizacja polityk RLS dla public.medication_logs
drop policy if exists medication_logs_read on public.medication_logs;
create policy medication_logs_read on public.medication_logs
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists medication_logs_update on public.medication_logs;
create policy medication_logs_update on public.medication_logs
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists medication_logs_delete on public.medication_logs;
create policy medication_logs_delete on public.medication_logs
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- 3. Upewnienie się o uprawnieniach GRANT dla API
grant select on public.medication_schedules to anon, authenticated, service_role;
grant select on public.medication_logs to anon, authenticated, service_role;
