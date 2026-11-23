-- ==============================================================================
-- Migracja: storage_orphaned_cleanup
-- Funkcja porządkująca osierocone pliki w Supabase Storage (medical-documents i pet-avatars)
-- Starsze niż zadany interwał (domyślnie 24 godziny), które nie zostały powiązane
-- z żadnym rekordem medycznym (wynik_badania, pet_health_event) ani profilem (zwierze).
-- ==============================================================================

create or replace function private.cleanup_orphaned_storage(
  p_older_than interval default interval '24 hours'
)
returns table (
  bucket_id text,
  deleted_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - p_older_than;
  v_med_count bigint := 0;
  v_avatar_count bigint := 0;
begin
  -- 1. Usunięcie niepowiązanych dokumentów medycznych starszych niż cutoff
  with deleted_docs as (
    delete from storage.objects
    where storage.objects.bucket_id = 'medical-documents'
      and storage.objects.created_at < v_cutoff
      and not exists (
        select 1 from public.wynik_badania r
        where r.source_path = storage.objects.name
      )
      and not exists (
        select 1 from public.pet_health_event e
        where e.source_path = storage.objects.name
      )
    returning 1
  )
  select count(*) into v_med_count from deleted_docs;

  -- 2. Usunięcie niepowiązanych awatarów zwierząt starszych niż cutoff
  with deleted_avatars as (
    delete from storage.objects
    where storage.objects.bucket_id = 'pet-avatars'
      and storage.objects.created_at < v_cutoff
      and not exists (
        select 1 from public.zwierze z
        where z.avatar_path = storage.objects.name
      )
    returning 1
  )
  select count(*) into v_avatar_count from deleted_avatars;

  return query
    select 'medical-documents'::text, v_med_count
    union all
    select 'pet-avatars'::text, v_avatar_count;
end;
$$;

revoke all on function private.cleanup_orphaned_storage(interval) from public, anon, authenticated;
grant execute on function private.cleanup_orphaned_storage(interval) to service_role;
