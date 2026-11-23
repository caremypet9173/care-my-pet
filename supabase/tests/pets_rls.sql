-- Run as an administrator. All fixtures are rolled back, including auth users.
begin;
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select (public.create_pet('{"imie":"RLS test","gatunek":"cat","plec":"unknown","kastracja":null,"identyfikacja":"unknown"}')).id;
select (public.create_pet('{"imie":"RLS second","gatunek":"dog","plec":"unknown","kastracja":null,"identyfikacja":"none"}')).id;
do $$ begin
  if (select count(*) from public.zwierze) <> 2 then raise exception 'Owner cannot read pets'; end if;
  update public.zwierze set notatki='Owner edit' where imie='RLS test';
  if not found then raise exception 'Owner cannot edit'; end if;
  begin
    update public.zwierze set created_by='10000000-0000-4000-8000-000000000002';
    raise exception 'Allowed author change';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.czlonek_gospodarstwa(gospodarstwo_id,user_id)
select id,'10000000-0000-4000-8000-000000000002' from public.gospodarstwo
where owner_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.zwierze) <> 2 then raise exception 'Member cannot read pets'; end if;
  update public.zwierze set notatki='Member edit' where imie='RLS test';
  if not found then raise exception 'Member cannot edit'; end if;
  if not exists(select 1 from public.zwierze where updated_by=auth.uid()) then raise exception 'Wrong audit author'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.zwierze) then raise exception 'Outsider reads pets'; end if;
  if exists(select 1 from public.gospodarstwo) then raise exception 'Outsider reads households'; end if;
  if exists(select 1 from public.czlonek_gospodarstwa) then raise exception 'Outsider reads membership'; end if;
  update public.zwierze set imie='hacked';
  if found then raise exception 'Outsider edits pets'; end if;
  begin
    insert into public.gospodarstwo(owner_id) values ('10000000-0000-4000-8000-000000000001');
    raise exception 'Allowed spoofed household owner';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.czlonek_gospodarstwa(gospodarstwo_id,user_id)
      values (gen_random_uuid(),auth.uid());
    raise exception 'Allowed self invitation';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.zwierze; raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.create_pet('{}'); raise exception 'Anonymous write allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
