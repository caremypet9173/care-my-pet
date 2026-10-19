begin;
insert into auth.users(id) values ('30000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003');
insert into public.gospodarstwo(id,owner_id) values ('30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001');
insert into public.czlonek_gospodarstwa(gospodarstwo_id,user_id) values ('30000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002');
insert into public.zwierze(id,gospodarstwo_id,imie,gatunek,created_by,updated_by) values ('30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000004','MEDICAL RLS TEST','cat','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
insert into storage.objects(bucket_id,name) values ('medical-documents','30000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000006.pdf');
do $$ declare i integer; result uuid; begin
  for i in 1..2 loop
    result:=public.confirm_medical_report('30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000005',
      '30000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000006.pdf','test.pdf','application/pdf',
      '{"title":"TEST","test_date":"2026-09-15","rows":[{"name":"CREA","value":"1.7","unit":"mg/dl","reference":"0.8-1.6","category":"renal"}]}');
  end loop;
  if (select count(*) from public.pomiar_parametru where wynik_id=result)<>1 then raise exception 'Retry duplicated measurements'; end if;
  update storage.objects set metadata='{}' where bucket_id='medical-documents';
  if found then raise exception 'Source was overwritten'; end if;
  for i in 1..10 loop if not public.take_medical_read_quota() then raise exception 'Quota rejected too early'; end if; end loop;
  if public.take_medical_read_quota() then raise exception 'Quota exceeded'; end if;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.wynik_badania where id='30000000-0000-4000-8000-000000000006')<>1 then raise exception 'Member cannot read report'; end if;
  if not exists(select 1 from public.pomiar_parametru where wynik_id='30000000-0000-4000-8000-000000000006') then raise exception 'Member cannot read rows'; end if;
  if not exists(select 1 from storage.objects where bucket_id='medical-documents' and name like '30000000%') then raise exception 'Member cannot read source'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('medical-documents','30000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000007.pdf');
    raise exception 'Member can impersonate uploader';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.wynik_badania where id='30000000-0000-4000-8000-000000000006') then raise exception 'Outsider report leak'; end if;
  if exists(select 1 from public.pomiar_parametru where wynik_id='30000000-0000-4000-8000-000000000006') then raise exception 'Outsider measurement leak'; end if;
  if exists(select 1 from storage.objects where bucket_id='medical-documents' and name like '30000000%') then raise exception 'Outsider source leak'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('medical-documents','30000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000003/30000000-0000-4000-8000-000000000007.pdf');
    raise exception 'Outsider upload allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.wynik_badania;raise exception 'Anonymous report access';exception when insufficient_privilege then null;end;
end $$;
rollback;
