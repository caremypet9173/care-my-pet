-- Retry returns the existing ID only for the exact confirmed payload.
create or replace function public.confirm_medical_report(p_id uuid,p_pet_id uuid,p_source_path text,p_source_name text,p_source_mime text,p_report jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare home_id uuid; row jsonb; i integer:=0; existing public.wynik_badania;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Serialize retries of the same confirmation, including a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.wynik_badania where id=p_id;
  if found then
    if existing.created_by=auth.uid() and existing.zwierze_id=p_pet_id and existing.source_path=p_source_path
      and existing.title=p_report->>'title' and existing.test_date=(p_report->>'test_date')::date
      and existing.laboratory=coalesce(p_report->>'laboratory','') and existing.doctor=coalesce(p_report->>'doctor','')
      and existing.notes=coalesce(p_report->>'notes','') and existing.source_name=p_source_name and existing.source_mime=p_source_mime
      and coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',m.value,'unit',m.unit,'reference',m.reference,'category',m.category) order by m.ordinal)
        from public.pomiar_parametru m where m.wynik_id=p_id),'[]'::jsonb)=p_report->'rows'
      then return p_id; end if;
    raise exception 'Conflicting report id' using errcode='23505';
  end if;
  select gospodarstwo_id into strict home_id from public.zwierze where id=p_pet_id;
  if jsonb_typeof(p_report->'rows') is distinct from 'array' or jsonb_array_length(p_report->'rows')>100
    then raise exception 'Invalid measurements' using errcode='22023'; end if;
  insert into public.wynik_badania(id,gospodarstwo_id,zwierze_id,title,test_date,laboratory,doctor,notes,source_path,source_name,source_mime,created_by)
  values(p_id,home_id,p_pet_id,p_report->>'title',(p_report->>'test_date')::date,coalesce(p_report->>'laboratory',''),
    coalesce(p_report->>'doctor',''),coalesce(p_report->>'notes',''),p_source_path,p_source_name,p_source_mime,auth.uid());
  for row in select value from jsonb_array_elements(p_report->'rows') loop
    i:=i+1;
    insert into public.pomiar_parametru(wynik_id,gospodarstwo_id,ordinal,name,value,unit,reference,category)
    values(p_id,home_id,i,row->>'name',row->>'value',coalesce(row->>'unit',''),coalesce(row->>'reference',''),row->>'category');
  end loop;
  return p_id;
end $$;
