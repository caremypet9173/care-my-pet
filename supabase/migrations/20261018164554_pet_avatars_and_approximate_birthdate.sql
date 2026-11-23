alter table public.zwierze
  add column data_urodzenia_przyblizona boolean not null default false,
  add column avatar_path text,
  add constraint approximate_birthdate_requires_date check (not data_urodzenia_przyblizona or data_urodzenia is not null),
  add constraint avatar_path_format check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create index zwierze_avatar_path_idx on public.zwierze(avatar_path) where avatar_path is not null;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('pet-avatars', 'pet-avatars', false, 1048576, array['image/jpeg']);

create policy pet_avatar_upload on storage.objects for insert to authenticated
with check (bucket_id='pet-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create policy pet_avatar_read on storage.objects for select to authenticated
using (bucket_id='pet-avatars' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or name in (select avatar_path from public.zwierze where avatar_path is not null)
));
-- No UPDATE: an existing avatar cannot be overwritten. Replacement gets a new key.
-- Only unlinked files visible to their uploader can be removed through the API.
create policy pet_avatar_cleanup on storage.objects for delete to authenticated
using (bucket_id='pet-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.zwierze where avatar_path=storage.objects.name));

create function public.validate_pet_avatar() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.avatar_path is null then return new; end if;
  if tg_op='UPDATE' and new.avatar_path is not distinct from old.avatar_path then return new; end if;
  if split_part(new.avatar_path,'/',1) <> auth.uid()::text or not exists (
    select 1 from storage.objects where bucket_id='pet-avatars' and name=new.avatar_path
  ) then raise exception 'Avatar must be an existing upload owned by the caller' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function public.validate_pet_avatar() from public, anon, authenticated;
create trigger validate_pet_avatar before insert or update on public.zwierze
for each row execute function public.validate_pet_avatar();

create or replace function public.create_pet(p_pet jsonb) returns public.zwierze
language plpgsql security invoker set search_path = '' as $$
declare home_id uuid; result public.zwierze; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.gospodarstwo(owner_id) values (caller) on conflict (owner_id) do nothing;
  select id into strict home_id from public.gospodarstwo where owner_id = caller;
  insert into public.zwierze(gospodarstwo_id, imie, gatunek, rasa, data_urodzenia, plec,
    kastracja, identyfikacja, numer_id, notatki, created_by, updated_by, data_urodzenia_przyblizona, avatar_path)
  values (home_id, p_pet->>'imie', p_pet->>'gatunek', p_pet->>'rasa',
    (p_pet->>'data_urodzenia')::date, p_pet->>'plec', (p_pet->>'kastracja')::boolean,
    p_pet->>'identyfikacja', p_pet->>'numer_id', p_pet->>'notatki', caller, caller,
    coalesce((p_pet->>'data_urodzenia_przyblizona')::boolean,false),p_pet->>'avatar_path')
  returning * into result;
  return result;
end;
$$;
