-- ============================================================================
-- Single-round-trip RPC for the Household Dashboard page (/app)
-- Replaces 9 separate PostgREST HTTP requests across 2 sequential hops with
-- 1 SQL round-trip while preserving full PostgreSQL RLS (SECURITY INVOKER).
-- ============================================================================

create or replace function public.get_household_dashboard_bundle(
  p_selected_household_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_household public.gospodarstwo%rowtype;
  v_is_owner boolean := false;
  v_member_role text := null;
  v_can_manage boolean := false;
  v_pets jsonb;
  v_health_events jsonb;
  v_schedule_items jsonb;
  v_notification_settings jsonb;
  v_reports_summary jsonb;
  v_medication_schedules jsonb;
  v_medication_logs jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  -- 1. Resolve active household (priority: selected -> oldest owned -> oldest member -> any RLS-visible)
  if p_selected_household_id is not null then
    select g.*
    into v_household
    from public.gospodarstwo g
    where g.id = p_selected_household_id
      and (
        g.owner_id = v_uid
        or exists (
          select 1
          from public.czlonek_gospodarstwa m
          where m.gospodarstwo_id = g.id
            and m.user_id = v_uid
        )
      )
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.gospodarstwo g
    where g.owner_id = v_uid
    order by g.created_at asc
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.czlonek_gospodarstwa m
    join public.gospodarstwo g on g.id = m.gospodarstwo_id
    where m.user_id = v_uid
    order by m.created_at asc
    limit 1;
  end if;

  if v_household.id is null then
    select g.*
    into v_household
    from public.gospodarstwo g
    order by g.created_at asc
    limit 1;
  end if;

  -- Brand-new user with zero households: return null so TS fallback can auto-create initial household
  if v_household.id is null then
    return null;
  end if;

  -- 2. Resolve role in active household
  v_is_owner := (v_household.owner_id = v_uid);
  select m.rola
  into v_member_role
  from public.czlonek_gospodarstwa m
  where m.gospodarstwo_id = v_household.id
    and m.user_id = v_uid
  limit 1;

  v_can_manage := v_is_owner or (v_member_role = 'admin');

  -- 3. Pets with report counts (both active and archived, ordered by created_at asc)
  select coalesce(
    jsonb_agg(
      to_jsonb(z) || jsonb_build_object('report_count', coalesce(rc.cnt, 0))
      order by z.created_at asc
    ),
    '[]'::jsonb
  )
  into v_pets
  from public.zwierze z
  left join (
    select wb.zwierze_id, count(*)::int as cnt
    from public.wynik_badania wb
    where wb.gospodarstwo_id = v_household.id
    group by wb.zwierze_id
  ) rc on rc.zwierze_id = z.id
  where z.gospodarstwo_id = v_household.id;

  -- 4. Health events (limit 500)
  select coalesce(
    jsonb_agg(to_jsonb(he) order by he.event_date desc, he.created_at desc),
    '[]'::jsonb
  )
  into v_health_events
  from (
    select pe.*
    from public.pet_health_event pe
    where pe.household_id = v_household.id
    order by pe.event_date desc, pe.created_at desc
    limit 500
  ) he;

  -- 5. Schedule items (limit 300)
  select coalesce(
    jsonb_agg(to_jsonb(si) order by si.scheduled_date asc, si.created_at desc),
    '[]'::jsonb
  )
  into v_schedule_items
  from (
    select ps.*
    from public.pet_schedule_item ps
    where ps.household_id = v_household.id
    order by ps.scheduled_date asc, ps.created_at desc
    limit 300
  ) si;

  -- 6. Notification settings
  select to_jsonb(ns)
  into v_notification_settings
  from (
    select s.id, s.household_id, s.email_enabled, s.notify_7_days_before,
           s.notify_1_day_before, s.notify_day_of, s.custom_email
    from public.household_notification_settings s
    where s.household_id = v_household.id
    limit 1
  ) ns;

  -- 7. Calendar reports summary (limit 400)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rs.id,
        'pet_id', rs.zwierze_id,
        'title', rs.title,
        'test_date', rs.test_date,
        'laboratory', rs.laboratory,
        'doctor', rs.doctor
      )
      order by rs.test_date desc, rs.confirmed_at desc
    ),
    '[]'::jsonb
  )
  into v_reports_summary
  from (
    select wb.id, wb.zwierze_id, wb.title, wb.test_date, wb.laboratory, wb.doctor, wb.confirmed_at
    from public.wynik_badania wb
    where wb.gospodarstwo_id = v_household.id
    order by wb.test_date desc, wb.confirmed_at desc
    limit 400
  ) rs;

  -- 8. Medication schedules (limit 200)
  select coalesce(
    jsonb_agg(to_jsonb(ms) order by ms.start_date asc, ms.created_at desc),
    '[]'::jsonb
  )
  into v_medication_schedules
  from (
    select m.id, m.pet_id, m.household_id, m.name, m.dosage, m.schedule_type,
           m.interval_value, m.interval_unit, m.start_date, m.end_date,
           m.scheduled_time, m.scheduled_times, m.instructions, m.is_active,
           m.stock_quantity, m.low_stock_threshold, m.stock_unit,
           m.schedule_category, m.fluid_name, m.fluid_volume_ml,
           m.fluid_route, m.fluid_location, m.revision, m.created_by,
           m.created_at, m.updated_at
    from public.medication_schedules m
    where m.household_id = v_household.id
    order by m.start_date asc, m.created_at desc
    limit 200
  ) ms;

  -- 9. Medication logs (limit 500)
  select coalesce(
    jsonb_agg(to_jsonb(ml) order by ml.dose_date desc, ml.administered_at desc),
    '[]'::jsonb
  )
  into v_medication_logs
  from (
    select l.id, l.schedule_id, l.pet_id, l.household_id, l.dose_date,
           l.scheduled_time, l.administered_at, l.status, l.administered_by,
           l.notes, l.revision, l.created_by, l.created_at, l.updated_at
    from public.medication_logs l
    where l.household_id = v_household.id
    order by l.dose_date desc, l.administered_at desc
    limit 500
  ) ml;

  return jsonb_build_object(
    'household', jsonb_build_object(
      'id', v_household.id,
      'nazwa', v_household.nazwa,
      'owner_id', v_household.owner_id,
      'is_owner', v_is_owner,
      'can_manage', v_can_manage,
      'has_recovery_key', (v_household.recovery_key_set_at is not null),
      'recovery_email', case when v_can_manage then v_household.recovery_email else null end
    ),
    'pets', v_pets,
    'health_events', v_health_events,
    'schedule_items', v_schedule_items,
    'notification_settings', v_notification_settings,
    'reports_summary', v_reports_summary,
    'medication_schedules', v_medication_schedules,
    'medication_logs', v_medication_logs
  );
end;
$$;

revoke all on function public.get_household_dashboard_bundle(uuid) from public, anon;
grant execute on function public.get_household_dashboard_bundle(uuid) to authenticated, service_role;
