-- Metadata-only RLS regression in a transaction. No physical object is uploaded.
begin;
insert into auth.users(id) values ('20000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002'),('20000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
insert into storage.objects(bucket_id,name) values ('pet-avatars','20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004.jpg');
select (public.create_pet('{"imie":"AVATAR RLS TEST","gatunek":"cat","plec":"unknown","kastracja":null,"identyfikacja":"unknown","avatar_path":"20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004.jpg"}')).id;
do $$ begin
  if not exists(select 1 from storage.objects where bucket_id='pet-avatars') then raise exception 'Uploader cannot read avatar'; end if;
  update storage.objects set metadata='{}' where bucket_id='pet-avatars';
  if found then raise exception 'Allowed overwriting avatar'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('pet-avatars','20000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000005.jpg');
    raise exception 'Allowed upload to another user folder';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.czlonek_gospodarstwa(gospodarstwo_id,user_id)
select id,'20000000-0000-4000-8000-000000000002' from public.gospodarstwo where owner_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ begin
  if not exists(select 1 from storage.objects where name='20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004.jpg') then raise exception 'Member cannot read avatar'; end if;
  update public.zwierze set notatki='Member edit preserves avatar' where imie='AVATAR RLS TEST';
  if not found then raise exception 'Member cannot edit pet with avatar'; end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='pet-avatars') then raise exception 'Outsider can read avatars'; end if;
  begin
    perform public.create_pet('{"imie":"SPOOF","gatunek":"cat","plec":"unknown","kastracja":null,"identyfikacja":"unknown","avatar_path":"20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004.jpg"}');
    raise exception 'Outsider can attach someone else avatar';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='pet-avatars') then raise exception 'Anonymous can read avatars'; end if;
end $$;
rollback;
