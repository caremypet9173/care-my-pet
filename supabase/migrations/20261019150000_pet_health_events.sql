create table public.pet_health_event (
 id uuid primary key,
 pet_id uuid not null references public.zwierze(id) on delete cascade,
 household_id uuid not null references public.gospodarstwo(id),
 category text not null check(category in('visit','vaccination','prevention')),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 event_date date not null check(event_date>=date '1900-01-01' and event_date<=(now() at time zone 'Europe/Warsaw')::date),
 next_due_date date check(next_due_date is null or (next_due_date>=event_date and next_due_date<=date '2100-12-31')),
 clinic text not null default '' check(char_length(clinic)<=120),
 doctor text not null default '' check(char_length(doctor)<=120),
 batch_or_product text not null default '' check(char_length(batch_or_product)<=120),
 description text not null default '' check(char_length(description)<=2000),
 revision integer not null default 1,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index pet_health_event_pet_date on public.pet_health_event(pet_id,event_date desc,created_at desc);
create index pet_health_event_household on public.pet_health_event(household_id);
alter table public.pet_health_event enable row level security;
revoke all on public.pet_health_event from public,anon,authenticated;
grant select,insert,update,delete on public.pet_health_event to authenticated;
create policy health_event_read on public.pet_health_event for select to authenticated using(household_id in(select id from public.gospodarstwo));
create policy health_event_insert on public.pet_health_event for insert to authenticated with check(created_by=auth.uid() and household_id in(select id from public.gospodarstwo));
create policy health_event_update on public.pet_health_event for update to authenticated using(household_id in(select id from public.gospodarstwo)) with check(household_id in(select id from public.gospodarstwo));
create policy health_event_delete on public.pet_health_event for delete to authenticated using(household_id in(select id from public.gospodarstwo));

create function public.validate_pet_health_event() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.zwierze where id=new.pet_id and gospodarstwo_id=new.household_id) then raise exception 'Pet mismatch' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if (new.id,new.pet_id,new.household_id,new.created_by,new.created_at) is distinct from (old.id,old.pet_id,old.household_id,old.created_by,old.created_at) then raise exception 'Immutable identity' using errcode='42501'; end if;
  new.revision:=old.revision+1;
 else
  new.created_by:=auth.uid();new.created_at:=now();new.revision:=1;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function public.validate_pet_health_event() from public,anon,authenticated;
create trigger health_event_validate before insert or update on public.pet_health_event for each row execute function public.validate_pet_health_event();

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
 p_description text
) returns public.pet_health_event language plpgsql security invoker set search_path='' as $$
declare result public.pet_health_event; home uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select gospodarstwo_id into strict home from public.zwierze where id=p_pet_id;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,3));
 select * into result from public.pet_health_event where id=p_id;
 if p_revision=0 then
  if found then
   if result.pet_id=p_pet_id and result.created_by=auth.uid() and result.category=p_category and result.title=p_title and result.event_date=p_event_date and result.next_due_date is not distinct from p_next_due_date and result.clinic=p_clinic and result.doctor=p_doctor and result.batch_or_product=p_batch_or_product and result.description=p_description and result.revision=1 then return result; end if;
   raise exception 'Conflicting entry' using errcode='PT409';
  end if;
  insert into public.pet_health_event(id,pet_id,household_id,category,title,event_date,next_due_date,clinic,doctor,batch_or_product,description,created_by)
  values(p_id,p_pet_id,home,p_category,p_title,p_event_date,p_next_due_date,p_clinic,p_doctor,p_batch_or_product,p_description,auth.uid())
  returning * into result;
 else
  update public.pet_health_event set category=p_category,title=p_title,event_date=p_event_date,next_due_date=p_next_due_date,clinic=p_clinic,doctor=p_doctor,batch_or_product=p_batch_or_product,description=p_description
  where id=p_id and pet_id=p_pet_id and revision=p_revision returning * into result;
  if not found then raise exception 'Entry changed or unavailable' using errcode='PT409'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_pet_health_event(uuid,uuid,integer,text,text,date,date,text,text,text,text) from public,anon;
grant execute on function public.save_pet_health_event(uuid,uuid,integer,text,text,date,date,text,text,text,text) to authenticated;

create function public.delete_pet_health_event(p_id uuid,p_pet_id uuid,p_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,3));
 delete from public.pet_health_event where id=p_id and pet_id=p_pet_id and revision=p_revision;
 if not found then raise exception 'Entry changed or unavailable' using errcode='PT409'; end if;
end $$;
revoke all on function public.delete_pet_health_event(uuid,uuid,integer) from public,anon;
grant execute on function public.delete_pet_health_event(uuid,uuid,integer) to authenticated;
