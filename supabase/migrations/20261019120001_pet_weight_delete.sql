grant delete on public.pet_weight to authenticated;
create policy weight_delete on public.pet_weight for delete to authenticated
using (household_id in (select id from public.gospodarstwo));
create function public.delete_pet_weight(p_id uuid,p_pet_id uuid,p_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,2));
 delete from public.pet_weight where id=p_id and pet_id=p_pet_id and revision=p_revision;
 if not found then raise exception 'Entry changed or unavailable' using errcode='PT409'; end if;
end $$;
revoke all on function public.delete_pet_weight(uuid,uuid,integer) from public,anon;
grant execute on function public.delete_pet_weight(uuid,uuid,integer) to authenticated;
