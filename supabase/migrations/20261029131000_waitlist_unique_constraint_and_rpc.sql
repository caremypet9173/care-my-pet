-- Dodaj unique constraint na email w tabeli waitlist (jeśli nie istnieje)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'waitlist_email_key'
      and conrelid = 'public.waitlist'::regclass
  ) then
    alter table public.waitlist add constraint waitlist_email_key unique (email);
  end if;
end $$;

-- Funkcja RPC do bezpiecznego zapisu na listę oczekujących (upsert)
create or replace function public.add_waitlist_entry(p_email text, p_pets_count integer default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm_email text := lower(btrim(p_email));
  v_count integer := coalesce(p_pets_count, 1);
begin
  if v_norm_email is null or v_norm_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  if v_count < 1 or v_count > 50 then
    v_count := 1;
  end if;

  insert into public.waitlist (email, pets_count, status)
  values (v_norm_email, v_count, 'pending')
  on conflict (email) do update
  set pets_count = excluded.pets_count;

  return true;
end;
$$;

revoke all on function public.add_waitlist_entry(text, integer) from public;
grant execute on function public.add_waitlist_entry(text, integer) to anon, authenticated, service_role;
