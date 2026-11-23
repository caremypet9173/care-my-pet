create table public.pet_weight (
 id uuid primary key,
 pet_id uuid not null references public.zwierze(id) on delete cascade,
 household_id uuid not null references public.gospodarstwo(id),
 kg numeric(8,3) not null check(kg>0 and kg<100000),
 measured_on date not null check(measured_on>=date '1900-01-01' and measured_on<=(now() at time zone 'Europe/Warsaw')::date),
 note text not null default '' check(char_length(note)<=200),
 revision integer not null default 1,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index pet_weight_pet_date on public.pet_weight(pet_id,measured_on desc,created_at desc);
create index pet_weight_household on public.pet_weight(household_id);
alter table public.pet_weight enable row level security;
revoke all on public.pet_weight from public,anon,authenticated;
grant select,insert,update on public.pet_weight to authenticated;
create policy weight_read on public.pet_weight for select to authenticated using(household_id in(select id from public.gospodarstwo));
create policy weight_insert on public.pet_weight for insert to authenticated with check(created_by=auth.uid() and household_id in(select id from public.gospodarstwo));
create policy weight_update on public.pet_weight for update to authenticated using(household_id in(select id from public.gospodarstwo)) with check(household_id in(select id from public.gospodarstwo));
create function public.validate_pet_weight() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.zwierze where id=new.pet_id and gospodarstwo_id=new.household_id) then raise exception 'Pet mismatch' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if (new.id,new.pet_id,new.household_id,new.created_by,new.created_at) is distinct from (old.id,old.pet_id,old.household_id,old.created_by,old.created_at) then raise exception 'Immutable identity' using errcode='42501'; end if;
  new.revision:=old.revision+1;
 else new.created_by:=auth.uid();new.created_at:=now();new.revision:=1;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function public.validate_pet_weight() from public,anon,authenticated;
create trigger weight_validate before insert or update on public.pet_weight for each row execute function public.validate_pet_weight();
create function public.save_pet_weight(p_id uuid,p_pet_id uuid,p_revision integer,p_kg numeric,p_date date,p_note text)
returns public.pet_weight language plpgsql security invoker set search_path='' as $$
declare result public.pet_weight; home uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select gospodarstwo_id into strict home from public.zwierze where id=p_pet_id;
 if p_kg<>round(p_kg,3) then raise exception 'At most three decimal places' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,2));
 select * into result from public.pet_weight where id=p_id;
 if p_revision=0 then
  if found then
   if result.pet_id=p_pet_id and result.created_by=auth.uid() and result.kg=p_kg and result.measured_on=p_date and result.note=p_note and result.revision=1 then return result; end if;
   raise exception 'Conflicting entry' using errcode='PT409';
  end if;
  insert into public.pet_weight(id,pet_id,household_id,kg,measured_on,note,created_by) values(p_id,p_pet_id,home,p_kg,p_date,p_note,auth.uid()) returning * into result;
 else
  update public.pet_weight set kg=p_kg,measured_on=p_date,note=p_note where id=p_id and pet_id=p_pet_id and revision=p_revision returning * into result;
  if not found then raise exception 'Entry changed or unavailable' using errcode='PT409'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_pet_weight(uuid,uuid,integer,numeric,date,text) from public,anon;
grant execute on function public.save_pet_weight(uuid,uuid,integer,numeric,date,text) to authenticated;
