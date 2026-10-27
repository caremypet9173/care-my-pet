delete from public.wynik_badania;
delete from public.pet_knowledge_chunk where source_type = 'medical_report';
delete from private.medical_read_quota;

do $$
begin
  delete from storage.objects
  where bucket_id = 'medical-documents'
    and not exists (
      select 1 from public.pet_health_event e where e.source_path = storage.objects.name
    );
exception
  when others then
    null;
end $$;
