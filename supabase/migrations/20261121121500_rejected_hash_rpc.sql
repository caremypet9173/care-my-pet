-- ============================================================================
-- Migracja #62: Service-role RPC dla private.rejected_document_hash
-- (schemat private nie jest wystawiany bezpośrednio przez PostgREST Data API).
-- ============================================================================

create or replace function public.get_rejected_document_hash(
  p_household_id uuid,
  p_source_sha256 text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'document_type', r.document_type,
    'reason', r.rejection_reason,
    'expires_at', r.expires_at
  )
  from private.rejected_document_hash r
  where r.household_id = p_household_id
    and r.source_sha256 = p_source_sha256
    and r.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_rejected_document_hash(uuid, text) from public, anon, authenticated;
grant execute on function public.get_rejected_document_hash(uuid, text) to service_role;

create or replace function public.remember_rejected_document_hash(
  p_household_id uuid,
  p_source_sha256 text,
  p_document_type text,
  p_rejection_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc_type text := case
    when p_document_type in ('non_medical', 'unreadable') then p_document_type
    else 'non_medical'
  end;
begin
  if p_household_id is null or p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  insert into private.rejected_document_hash (
    household_id,
    source_sha256,
    document_type,
    rejection_reason,
    created_at,
    expires_at
  ) values (
    p_household_id,
    p_source_sha256,
    v_doc_type,
    left(coalesce(p_rejection_reason, ''), 300),
    now(),
    now() + interval '24 hours'
  )
  on conflict (household_id, source_sha256) do update
  set document_type = excluded.document_type,
      rejection_reason = excluded.rejection_reason,
      created_at = now(),
      expires_at = now() + interval '24 hours';
end;
$$;

revoke all on function public.remember_rejected_document_hash(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.remember_rejected_document_hash(uuid, text, text, text) to service_role;
