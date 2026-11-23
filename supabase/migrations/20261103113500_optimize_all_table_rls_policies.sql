-- ==============================================================================
-- Migracja: optimize_all_table_rls_policies
-- Ujednolicenie i optymalizacja wydajnościowa polityk RLS we wszystkich tabelach
-- domenowych oraz Storage:
-- 1. Eliminacja kaskadowego skanowania tabeli gospodarstwo poprzez bezpośrednie
--    użycie security definer public.get_user_household_ids() (InitPlan).
-- 2. Zastąpienie bezpośrednich wywołań auth.uid() skalarnym podzapytaniem
--    (select auth.uid()), co zapobiega ewaluacji per-row (SubPlan O(N) -> O(1)).
-- 3. Zastąpienie kosztownych subkwerend IN (select avatar_path ...) warunkami EXISTS.
-- ==============================================================================

-- 1. Tabela: public.zwierze
drop policy if exists pet_read on public.zwierze;
create policy pet_read on public.zwierze
  for select to authenticated
  using (gospodarstwo_id in (select public.get_user_household_ids()));

drop policy if exists pet_create on public.zwierze;
create policy pet_create on public.zwierze
  for insert to authenticated
  with check (
    public.is_household_owner(gospodarstwo_id)
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists pet_update on public.zwierze;
create policy pet_update on public.zwierze
  for update to authenticated
  using (gospodarstwo_id in (select public.get_user_household_ids()))
  with check (
    gospodarstwo_id in (select public.get_user_household_ids())
    and updated_by = (select auth.uid())
  );

grant select on public.zwierze to anon;
grant select, insert, update on public.zwierze to authenticated;
grant select, insert, update, delete on public.zwierze to service_role;


-- 2. Tabela: public.wynik_badania
drop policy if exists report_read on public.wynik_badania;
create policy report_read on public.wynik_badania
  for select to authenticated
  using (gospodarstwo_id in (select public.get_user_household_ids()));

drop policy if exists report_insert on public.wynik_badania;
create policy report_insert on public.wynik_badania
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and gospodarstwo_id in (select public.get_user_household_ids())
  );

grant select on public.wynik_badania to anon;
grant select, insert on public.wynik_badania to authenticated;
grant select, insert, update, delete on public.wynik_badania to service_role;


-- 3. Tabela: public.pomiar_parametru
drop policy if exists measurement_read on public.pomiar_parametru;
create policy measurement_read on public.pomiar_parametru
  for select to authenticated
  using (gospodarstwo_id in (select public.get_user_household_ids()));

drop policy if exists measurement_insert on public.pomiar_parametru;
create policy measurement_insert on public.pomiar_parametru
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wynik_badania r
      where r.id = wynik_id
        and r.gospodarstwo_id = pomiar_parametru.gospodarstwo_id
        and r.created_by = (select auth.uid())
    )
  );

grant select on public.pomiar_parametru to anon;
grant select, insert on public.pomiar_parametru to authenticated;
grant select, insert, update, delete on public.pomiar_parametru to service_role;


-- 4. Tabela: public.measurement_correction
drop policy if exists correction_read on public.measurement_correction;
create policy correction_read on public.measurement_correction
  for select to authenticated
  using (
    exists (
      select 1 from public.pomiar_parametru p
      where p.id = measurement_correction.measurement_id
        and p.gospodarstwo_id in (select public.get_user_household_ids())
    )
  );

grant select on public.measurement_correction to anon;
grant select, insert, update on public.measurement_correction to authenticated;
grant select, insert, update, delete on public.measurement_correction to service_role;


-- 5. Tabela: public.pet_weight
drop policy if exists weight_read on public.pet_weight;
create policy weight_read on public.pet_weight
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists weight_insert on public.pet_weight;
create policy weight_insert on public.pet_weight
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

drop policy if exists weight_update on public.pet_weight;
create policy weight_update on public.pet_weight
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists weight_delete on public.pet_weight;
create policy weight_delete on public.pet_weight
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

grant select on public.pet_weight to anon;
grant select, insert, update, delete on public.pet_weight to authenticated;
grant select, insert, update, delete on public.pet_weight to service_role;


-- 6. Tabela: public.pet_health_event
drop policy if exists health_event_read on public.pet_health_event;
create policy health_event_read on public.pet_health_event
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists health_event_insert on public.pet_health_event;
create policy health_event_insert on public.pet_health_event
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

drop policy if exists health_event_update on public.pet_health_event;
create policy health_event_update on public.pet_health_event
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists health_event_delete on public.pet_health_event;
create policy health_event_delete on public.pet_health_event
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

grant select on public.pet_health_event to anon;
grant select, insert, update, delete on public.pet_health_event to authenticated;
grant select, insert, update, delete on public.pet_health_event to service_role;


-- 7. Tabela: public.pet_knowledge_chunk
drop policy if exists pet_knowledge_read on public.pet_knowledge_chunk;
create policy pet_knowledge_read on public.pet_knowledge_chunk
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists pet_knowledge_write on public.pet_knowledge_chunk;
create policy pet_knowledge_write on public.pet_knowledge_chunk
  for all to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

grant select on public.pet_knowledge_chunk to anon;
grant select, insert, update, delete on public.pet_knowledge_chunk to authenticated;
grant select, insert, update, delete on public.pet_knowledge_chunk to service_role;


-- 8. Tabela: public.pet_schedule_item
drop policy if exists schedule_item_read on public.pet_schedule_item;
create policy schedule_item_read on public.pet_schedule_item
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists schedule_item_insert on public.pet_schedule_item;
create policy schedule_item_insert on public.pet_schedule_item
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

drop policy if exists schedule_item_update on public.pet_schedule_item;
create policy schedule_item_update on public.pet_schedule_item
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

drop policy if exists schedule_item_delete on public.pet_schedule_item;
create policy schedule_item_delete on public.pet_schedule_item
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

grant select on public.pet_schedule_item to anon;
grant select, insert, update, delete on public.pet_schedule_item to authenticated;
grant select, insert, update, delete on public.pet_schedule_item to service_role;


-- 9. Tabela: public.pet_assistant_thread
drop policy if exists assistant_thread_read on public.pet_assistant_thread;
create policy assistant_thread_read on public.pet_assistant_thread
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists assistant_thread_insert on public.pet_assistant_thread;
create policy assistant_thread_insert on public.pet_assistant_thread
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

drop policy if exists assistant_thread_update on public.pet_assistant_thread;
create policy assistant_thread_update on public.pet_assistant_thread
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

grant select on public.pet_assistant_thread to anon;
grant select, insert, update, delete on public.pet_assistant_thread to authenticated;
grant select, insert, update, delete on public.pet_assistant_thread to service_role;


-- 10. Tabela: public.pet_assistant_message
drop policy if exists assistant_message_read on public.pet_assistant_message;
create policy assistant_message_read on public.pet_assistant_message
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

drop policy if exists assistant_message_insert on public.pet_assistant_message;
create policy assistant_message_insert on public.pet_assistant_message
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and household_id in (select public.get_user_household_ids())
  );

grant select on public.pet_assistant_message to anon;
grant select, insert, update, delete on public.pet_assistant_message to authenticated;
grant select, insert, update, delete on public.pet_assistant_message to service_role;


-- 11. Storage: medical-documents
drop policy if exists medical_upload on storage.objects;
create policy medical_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] in (select public.get_user_household_ids()::text)
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  );

drop policy if exists medical_read on storage.objects;
create policy medical_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] in (select public.get_user_household_ids()::text)
  );

drop policy if exists medical_cleanup on storage.objects;
create policy medical_cleanup on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] in (select public.get_user_household_ids()::text)
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and not exists (select 1 from public.wynik_badania r where r.source_path = storage.objects.name)
    and not exists (select 1 from public.pet_health_event e where e.source_path = storage.objects.name)
  );


-- 12. Storage: pet-avatars
drop policy if exists pet_avatar_read on storage.objects;
create policy pet_avatar_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pet-avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.zwierze z
        where z.avatar_path = storage.objects.name
      )
    )
  );

drop policy if exists pet_avatar_cleanup on storage.objects;
create policy pet_avatar_cleanup on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.zwierze z
      where z.avatar_path = storage.objects.name
    )
  );
