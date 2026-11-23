create or replace function public.correct_measurement(p_pet_id uuid,p_measurement_id uuid,p_revision integer,p_value text,p_unit text,p_reference text,p_note text,p_is_key boolean)
returns public.measurement_correction language plpgsql security definer set search_path='' as $$
declare result public.measurement_correction; home_id uuid;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 select m.gospodarstwo_id into home_id from public.pomiar_parametru m
 join public.wynik_badania r on r.id=m.wynik_id
 where m.id=p_measurement_id and r.zwierze_id=p_pet_id;
 if home_id is null or not exists(select 1 from public.gospodarstwo g where g.id=home_id
   and (g.owner_id=auth.uid() or exists(select 1 from public.czlonek_gospodarstwa c where c.gospodarstwo_id=g.id and c.user_id=auth.uid()))) then
  raise exception 'Measurement not accessible' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_measurement_id::text,1));
 select * into result from public.measurement_correction where measurement_id=p_measurement_id;
 if p_revision is null or p_revision<>coalesce(result.revision,0) then
  raise exception 'Correction has changed' using errcode='PT409';
 end if;
 insert into public.measurement_correction(measurement_id,value,unit,reference,note,is_key,revision,updated_by)
 values(p_measurement_id,p_value,p_unit,p_reference,p_note,p_is_key,p_revision+1,auth.uid())
 on conflict(measurement_id) do update set value=excluded.value,unit=excluded.unit,reference=excluded.reference,
 note=excluded.note,is_key=excluded.is_key,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
 returning * into result;
 return result;
end $$;
revoke all on function public.correct_measurement(uuid,uuid,integer,text,text,text,text,boolean) from public,anon;
grant execute on function public.correct_measurement(uuid,uuid,integer,text,text,text,text,boolean) to authenticated;
