-- ==============================================================================
-- Migracja: medication_realtime_and_rls_optimization
-- Włączenie Supabase Realtime dla ewidencji podań leków i harmonogramów
-- oraz optymalizacja polityk RLS (InitPlan (select auth.uid()))
-- ==============================================================================

-- 1. Ustawienie REPLICA IDENTITY FULL dla pełnych payloadów zdarzeń DELETE/UPDATE
alter table public.medication_logs replica identity full;
alter table public.medication_schedules replica identity full;

-- 2. Dodanie tabel do publikacji supabase_realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'medication_logs'
  ) then
    alter publication supabase_realtime add table public.medication_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'medication_schedules'
  ) then
    alter publication supabase_realtime add table public.medication_schedules;
  end if;
end $$;

-- 3. Optymalizacja polityk RLS pod kątem wydajności (InitPlan O(1))
drop policy if exists medication_schedules_insert on public.medication_schedules;
create policy medication_schedules_insert on public.medication_schedules
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select id from public.gospodarstwo)
  );

drop policy if exists medication_logs_insert on public.medication_logs;
create policy medication_logs_insert on public.medication_logs
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select id from public.gospodarstwo)
  );
