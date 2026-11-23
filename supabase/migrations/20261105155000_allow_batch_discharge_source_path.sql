-- Migracja: Zezwolenie na współdzielenie pliku źródłowego przez wynik_badania w imporcie wypisu
-- Uaktualnienie validate_report_source(), aby akceptowała source_path w formacie:
--   <gospodarstwo_id>/<user_id>/<uuid>.<ext>
-- tak samo jak w tabeli pet_health_event (zamiast wymogu <gospodarstwo_id>/<user_id>/<report_id>.<ext>).

create or replace function public.validate_report_source() returns trigger language plpgsql security invoker set search_path='' as $$
declare ext text;
begin
  if not exists(select 1 from public.zwierze z where z.id=new.zwierze_id and z.gospodarstwo_id=new.gospodarstwo_id)
    then raise exception 'Pet and household mismatch' using errcode='42501'; end if;
  ext:=case new.source_mime when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else '' end;
  if (
      new.source_path !~ ('^'||new.gospodarstwo_id::text||'/'||auth.uid()::text||'/[0-9a-f-]{36}\.'||ext||'$')
      and new.source_path <> (new.gospodarstwo_id::text||'/'||auth.uid()::text||'/'||new.id::text||'.'||ext)
    )
    or not exists(select 1 from storage.objects where bucket_id='medical-documents' and name=new.source_path)
  then
    raise exception 'Existing source owned by caller required' using errcode='42501';
  end if;
  new.confirmed_at:=now(); new.created_by:=auth.uid(); return new;
end $$;

revoke all on function public.validate_report_source() from public,anon,authenticated;
