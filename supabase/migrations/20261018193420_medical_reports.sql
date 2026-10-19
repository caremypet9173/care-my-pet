-- Confirmed records only. Unconfirmed extracted values remain in browser memory.
create table public.wynik_badania (
  id uuid primary key,
  gospodarstwo_id uuid not null references public.gospodarstwo(id),
  zwierze_id uuid not null references public.zwierze(id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  test_date date not null check (test_date between date '1900-01-01' and current_date),
  laboratory text not null default '' check (char_length(laboratory)<=160),
  doctor text not null default '' check (char_length(doctor)<=160),
  notes text not null default '' check (char_length(notes)<=4000),
  source_path text not null unique,
  source_name text not null check (char_length(source_name) between 1 and 180),
  source_mime text not null check (source_mime in ('application/pdf','image/jpeg','image/png')),
  created_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now()
);
create index wynik_pet_date_idx on public.wynik_badania(zwierze_id, test_date desc);
create index wynik_household_idx on public.wynik_badania(gospodarstwo_id);
create index wynik_author_idx on public.wynik_badania(created_by);
create table public.pomiar_parametru (
  id uuid primary key default gen_random_uuid(),
  wynik_id uuid not null references public.wynik_badania(id) on delete cascade,
  gospodarstwo_id uuid not null references public.gospodarstwo(id),
  ordinal integer not null check (ordinal between 1 and 100),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  value text not null check (char_length(btrim(value)) between 1 and 60),
  unit text not null default '' check (char_length(unit)<=40),
  reference text not null default '' check (char_length(reference)<=100),
  category text not null check (category in ('blood','renal','liver','other')),
  unique(wynik_id,ordinal)
);
create index pomiar_household_idx on public.pomiar_parametru(gospodarstwo_id);
alter table public.wynik_badania enable row level security;
alter table public.pomiar_parametru enable row level security;
revoke all on public.wynik_badania, public.pomiar_parametru from anon, authenticated;
grant select, insert on public.wynik_badania, public.pomiar_parametru to authenticated;
create policy report_read on public.wynik_badania for select to authenticated
using (gospodarstwo_id in (select id from public.gospodarstwo));
create policy report_insert on public.wynik_badania for insert to authenticated
with check (created_by=(select auth.uid()) and gospodarstwo_id in (select id from public.gospodarstwo));
create policy measurement_read on public.pomiar_parametru for select to authenticated
using (gospodarstwo_id in (select id from public.gospodarstwo));
create policy measurement_insert on public.pomiar_parametru for insert to authenticated
with check (exists(select 1 from public.wynik_badania r where r.id=wynik_id
  and r.gospodarstwo_id=pomiar_parametru.gospodarstwo_id and r.created_by=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('medical-documents','medical-documents',false,6291456,array['application/pdf','image/jpeg','image/png']);
create policy medical_upload on storage.objects for insert to authenticated with check (
  bucket_id='medical-documents'
  and (storage.foldername(name))[1] in (select id::text from public.gospodarstwo)
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$');
create policy medical_read on storage.objects for select to authenticated using (
  bucket_id='medical-documents'
  and (storage.foldername(name))[1] in (select id::text from public.gospodarstwo));
-- No overwrite. Cleanup is permitted only for unreferenced objects owned by the caller.
create policy medical_cleanup on storage.objects for delete to authenticated using (
  bucket_id='medical-documents' and (storage.foldername(name))[1] in (select id::text from public.gospodarstwo)
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and not exists(select 1 from public.wynik_badania r where r.source_path=storage.objects.name));

create function public.validate_report_source() returns trigger language plpgsql security invoker set search_path='' as $$
declare ext text;
begin
  if not exists(select 1 from public.zwierze z where z.id=new.zwierze_id and z.gospodarstwo_id=new.gospodarstwo_id)
    then raise exception 'Pet and household mismatch' using errcode='42501'; end if;
  ext:=case new.source_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else '' end;
  if new.source_path <> new.gospodarstwo_id::text||'/'||auth.uid()::text||'/'||new.id::text||'.'||ext
    or not exists(select 1 from storage.objects where bucket_id='medical-documents' and name=new.source_path)
    then raise exception 'Existing source owned by caller required' using errcode='42501'; end if;
  new.confirmed_at:=now(); new.created_by:=auth.uid(); return new;
end $$;
revoke all on function public.validate_report_source() from public,anon,authenticated;
create trigger validate_report_source before insert on public.wynik_badania for each row execute function public.validate_report_source();

create function public.confirm_medical_report(p_id uuid,p_pet_id uuid,p_source_path text,p_source_name text,p_source_mime text,p_report jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare home_id uuid; row jsonb; i integer:=0; existing public.wynik_badania;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Serialize retries of the same confirmation, including a lost HTTP response.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.wynik_badania where id=p_id;
  if found then
    if existing.created_by=auth.uid() and existing.zwierze_id=p_pet_id and existing.source_path=p_source_path then return p_id; end if;
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
revoke all on function public.confirm_medical_report(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.confirm_medical_report(uuid,uuid,text,text,text,jsonb) to authenticated;

-- Only request counters, never unconfirmed medical data. Callers cannot reset counters.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create table private.medical_read_quota(user_id uuid references auth.users(id) on delete cascade, day date, used integer not null, primary key(user_id,day));
alter table private.medical_read_quota enable row level security;
revoke all on private.medical_read_quota from public,anon,authenticated;
create function private.take_medical_read_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare count integer;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return false; end if;
  insert into private.medical_read_quota(user_id,day,used) values(auth.uid(),(now() at time zone 'UTC')::date,1)
  on conflict(user_id,day) do update set used=private.medical_read_quota.used+1
  where private.medical_read_quota.used<10 returning used into count;
  return count is not null;
end $$;
revoke all on function private.take_medical_read_quota() from public,anon;
grant execute on function private.take_medical_read_quota() to authenticated;
create function public.take_medical_read_quota() returns boolean language sql security invoker set search_path='' as $$select private.take_medical_read_quota()$$;
revoke all on function public.take_medical_read_quota() from public,anon;
grant execute on function public.take_medical_read_quota() to authenticated;
