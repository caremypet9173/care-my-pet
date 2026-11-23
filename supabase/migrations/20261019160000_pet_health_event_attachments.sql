alter table public.pet_health_event
  add column source_path text unique,
  add column source_name text check (source_name is null or char_length(source_name) between 1 and 180),
  add column source_mime text check (source_mime is null or source_mime in ('application/pdf','image/jpeg','image/png')),
  add constraint pet_health_event_source_complete check (
    (source_path is null and source_name is null and source_mime is null)
    or (source_path is not null and source_name is not null and source_mime is not null)
  );

drop policy if exists medical_cleanup on storage.objects;
create policy medical_cleanup on storage.objects for delete to authenticated using (
  bucket_id='medical-documents'
  and (storage.foldername(name))[1] in (select id::text from public.gospodarstwo)
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and not exists(select 1 from public.wynik_badania r where r.source_path=storage.objects.name)
  and not exists(select 1 from public.pet_health_event e where e.source_path=storage.objects.name)
);

create or replace function public.validate_pet_health_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare ext text;
begin
  if not exists(select 1 from public.zwierze where id=new.pet_id and gospodarstwo_id=new.household_id) then
    raise exception 'Pet mismatch' using errcode='42501';
  end if;
  if new.source_path is not null and (tg_op='INSERT' or new.source_path is distinct from old.source_path) then
    ext:=case new.source_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else '' end;
    if new.source_path !~ ('^'||new.household_id::text||'/'||auth.uid()::text||'/[0-9a-f-]{36}\.'||ext||'$')
      or not exists(select 1 from storage.objects where bucket_id='medical-documents' and name=new.source_path)
    then
      raise exception 'Existing source owned by caller required' using errcode='42501';
    end if;
  end if;
  if tg_op='UPDATE' then
    if (new.id,new.pet_id,new.household_id,new.created_by,new.created_at) is distinct from (old.id,old.pet_id,old.household_id,old.created_by,old.created_at) then
      raise exception 'Immutable identity' using errcode='42501';
    end if;
    new.revision:=old.revision+1;
  else
    new.created_by:=auth.uid();
    new.created_at:=now();
    new.revision:=1;
  end if;
  new.updated_at:=now();
  return new;
end $$;

drop function if exists public.save_pet_health_event(uuid,uuid,integer,text,text,date,date,text,text,text,text);

create function public.save_pet_health_event(
  p_id uuid,
  p_pet_id uuid,
  p_revision integer,
  p_category text,
  p_title text,
  p_event_date date,
  p_next_due_date date,
  p_clinic text,
  p_doctor text,
  p_batch_or_product text,
  p_description text,
  p_source_path text default null,
  p_source_name text default null,
  p_source_mime text default null
) returns public.pet_health_event language plpgsql security invoker set search_path='' as $$
declare result public.pet_health_event; home uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select gospodarstwo_id into strict home from public.zwierze where id=p_pet_id;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,3));
  select * into result from public.pet_health_event where id=p_id;
  if p_revision=0 then
    if found then
      if result.pet_id=p_pet_id and result.created_by=auth.uid() and result.category=p_category and result.title=p_title and result.event_date=p_event_date and result.next_due_date is not distinct from p_next_due_date and result.clinic=p_clinic and result.doctor=p_doctor and result.batch_or_product=p_batch_or_product and result.description=p_description and result.source_path is not distinct from p_source_path and result.revision=1 then
        return result;
      end if;
      raise exception 'Conflicting entry' using errcode='PT409';
    end if;
    insert into public.pet_health_event(
      id,pet_id,household_id,category,title,event_date,next_due_date,clinic,doctor,batch_or_product,description,source_path,source_name,source_mime,created_by
    ) values(
      p_id,p_pet_id,home,p_category,p_title,p_event_date,p_next_due_date,p_clinic,p_doctor,p_batch_or_product,p_description,p_source_path,p_source_name,p_source_mime,auth.uid()
    ) returning * into result;
  else
    update public.pet_health_event
    set category=p_category,
        title=p_title,
        event_date=p_event_date,
        next_due_date=p_next_due_date,
        clinic=p_clinic,
        doctor=p_doctor,
        batch_or_product=p_batch_or_product,
        description=p_description,
        source_path=coalesce(p_source_path, source_path),
        source_name=coalesce(p_source_name, source_name),
        source_mime=coalesce(p_source_mime, source_mime)
    where id=p_id and pet_id=p_pet_id and revision=p_revision
    returning * into result;
    if not found then raise exception 'Entry changed or unavailable' using errcode='PT409'; end if;
  end if;
  return result;
end $$;

revoke all on function public.save_pet_health_event(uuid,uuid,integer,text,text,date,date,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.save_pet_health_event(uuid,uuid,integer,text,text,date,date,text,text,text,text,text,text,text) to authenticated;
