-- ============================================================================
-- Single-round-trip RPC for the Pet Record page (/app/pets/[id])
-- Replaces 13-14 separate PostgREST HTTP requests with 1 SQL round-trip while
-- preserving full PostgreSQL RLS enforcement (SECURITY INVOKER).
-- ============================================================================

create or replace function public.get_pet_record_bundle(
  p_pet_id uuid,
  p_requested_report_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pet public.zwierze%rowtype;
  v_household jsonb;
  v_members jsonb;
  v_switcher_pets jsonb;
  v_notification_settings jsonb;
  v_reports jsonb;
  v_weights jsonb;
  v_vital_measurements jsonb;
  v_fluids jsonb;
  v_health_events jsonb;
  v_schedule_items jsonb;
  v_medication_schedules jsonb;
  v_medication_logs jsonb;
begin
  -- 1. Load pet (RLS enforces household membership)
  select z.*
  into v_pet
  from public.zwierze z
  where z.id = p_pet_id;

  if not found then
    return null;
  end if;

  -- 2. Household core fields (RLS enforced)
  select jsonb_build_object(
    'id', g.id,
    'nazwa', g.nazwa,
    'owner_id', g.owner_id,
    'recovery_email', g.recovery_email,
    'recovery_key_set_at', g.recovery_key_set_at
  )
  into v_household
  from public.gospodarstwo g
  where g.id = v_pet.gospodarstwo_id;

  -- 3. Household members (narrow columns for roles & display names)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'email', m.email,
        'rola', m.rola
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.czlonek_gospodarstwa m
  where m.gospodarstwo_id = v_pet.gospodarstwo_id;

  -- 4. Active switcher pets (skipped when viewing an archived pet)
  if v_pet.archived_at is null then
    select coalesce(
      jsonb_agg(to_jsonb(sp) order by sp.created_at asc),
      '[]'::jsonb
    )
    into v_switcher_pets
    from (
      select z.id, z.imie, z.gatunek, z.avatar_path, z.tagi, z.created_at
      from public.zwierze z
      where z.gospodarstwo_id = v_pet.gospodarstwo_id
        and z.archived_at is null
      order by z.created_at asc
      limit 50
    ) sp;
  else
    v_switcher_pets := '[]'::jsonb;
  end if;

  -- 5. Household notification settings
  select to_jsonb(ns)
  into v_notification_settings
  from (
    select s.id, s.household_id, s.email_enabled, s.notify_7_days_before,
           s.notify_1_day_before, s.notify_day_of, s.custom_email
    from public.household_notification_settings s
    where s.household_id = v_pet.gospodarstwo_id
    limit 1
  ) ns;

  -- 6. Medical reports (top 100 + optional deep-linked report) with nested rows & corrections
  with selected_reports as (
    select r.*
    from (
      select wb.*
      from public.wynik_badania wb
      where wb.zwierze_id = p_pet_id
      order by wb.test_date desc, wb.confirmed_at desc
      limit 100
    ) r
    union
    select wb.*
    from public.wynik_badania wb
    where p_requested_report_id is not null
      and wb.zwierze_id = p_pet_id
      and wb.id = p_requested_report_id
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(sr) || jsonb_build_object(
        'rows',
        coalesce(
          (
            select jsonb_agg(
              to_jsonb(pp) || jsonb_build_object(
                'correction',
                (
                  select to_jsonb(mc)
                  from public.measurement_correction mc
                  where mc.measurement_id = pp.id
                  limit 1
                )
              )
              order by pp.ordinal asc
            )
            from public.pomiar_parametru pp
            where pp.wynik_id = sr.id
          ),
          '[]'::jsonb
        )
      )
      order by sr.test_date desc, sr.confirmed_at desc
    ),
    '[]'::jsonb
  )
  into v_reports
  from selected_reports sr;

  -- 7. Weights
  select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
  into v_weights
  from (
    select pw.*
    from public.pet_weight pw
    where pw.pet_id = p_pet_id
    order by pw.measured_on desc, pw.created_at desc
    limit 500
  ) w;

  -- 8. Vital measurements
  select coalesce(jsonb_agg(to_jsonb(vm)), '[]'::jsonb)
  into v_vital_measurements
  from (
    select pv.*
    from public.pet_vital_measurement pv
    where pv.pet_id = p_pet_id
    order by pv.measured_on desc, pv.measured_at desc, pv.created_at desc
    limit 500
  ) vm;

  -- 9. Fluid therapies
  select coalesce(jsonb_agg(to_jsonb(ft)), '[]'::jsonb)
  into v_fluids
  from (
    select pf.*
    from public.pet_fluid_therapy pf
    where pf.pet_id = p_pet_id
    order by pf.administered_on desc, pf.administered_at desc, pf.created_at desc
    limit 500
  ) ft;

  -- 10. Health events
  select coalesce(jsonb_agg(to_jsonb(he)), '[]'::jsonb)
  into v_health_events
  from (
    select pe.*
    from public.pet_health_event pe
    where pe.pet_id = p_pet_id
    order by pe.event_date desc, pe.created_at desc
    limit 300
  ) he;

  -- 11. Schedule items
  select coalesce(jsonb_agg(to_jsonb(si)), '[]'::jsonb)
  into v_schedule_items
  from (
    select ps.*
    from public.pet_schedule_item ps
    where ps.pet_id = p_pet_id
    order by ps.scheduled_date asc, ps.created_at desc
    limit 200
  ) si;

  -- 12. Medication schedules
  select coalesce(jsonb_agg(to_jsonb(ms)), '[]'::jsonb)
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
    where m.pet_id = p_pet_id
    order by m.start_date asc, m.created_at desc
    limit 200
  ) ms;

  -- 13. Medication logs
  select coalesce(jsonb_agg(to_jsonb(ml)), '[]'::jsonb)
  into v_medication_logs
  from (
    select l.id, l.schedule_id, l.pet_id, l.household_id, l.dose_date,
           l.scheduled_time, l.administered_at, l.status, l.administered_by,
           l.notes, l.revision, l.created_by, l.created_at, l.updated_at
    from public.medication_logs l
    where l.pet_id = p_pet_id
    order by l.dose_date desc, l.administered_at desc
    limit 300
  ) ml;

  return jsonb_build_object(
    'pet', to_jsonb(v_pet),
    'household', v_household,
    'members', v_members,
    'switcher_pets', v_switcher_pets,
    'notification_settings', v_notification_settings,
    'reports', v_reports,
    'weights', v_weights,
    'vital_measurements', v_vital_measurements,
    'fluids', v_fluids,
    'health_events', v_health_events,
    'schedule_items', v_schedule_items,
    'medication_schedules', v_medication_schedules,
    'medication_logs', v_medication_logs
  );
end;
$$;

revoke all on function public.get_pet_record_bundle(uuid, uuid) from public, anon;
grant execute on function public.get_pet_record_bundle(uuid, uuid) to authenticated, service_role;
