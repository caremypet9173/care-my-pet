-- Supabase's internal event trigger does not need to be callable by API roles.
-- Some local installations do not provide this managed-platform helper.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
