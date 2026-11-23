-- Ponowne zgłoszenie adresu już obecnego w public.waitlist:
-- 1. Dla statusu 'invited' zachowuje status i admin_notified_at (aktualizuje tylko pets_count).
-- 2. Dla statusu 'rejected' przywraca status 'pending'.
-- 3. Zeruje admin_notified_at, jeśli poprzednie powiadomienie było starsze niż 15 minut,
--    aby godzinowy digest powiadomił administratora o ponowionej prośbie (z ochroną przed spamem).
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

  insert into public.waitlist (email, pets_count, status, admin_notified_at)
  values (v_norm_email, v_count, 'pending', null)
  on conflict (email) do update
  set
    pets_count = excluded.pets_count,
    status = case
      when public.waitlist.status = 'invited' then 'invited'
      else 'pending'
    end,
    admin_notified_at = case
      when public.waitlist.status = 'invited' then public.waitlist.admin_notified_at
      when public.waitlist.admin_notified_at is not null
           and public.waitlist.admin_notified_at < now() - interval '15 minutes' then null
      else public.waitlist.admin_notified_at
    end;

  return true;
end;
$$;

revoke all on function public.add_waitlist_entry(text, integer) from public;
grant execute on function public.add_waitlist_entry(text, integer) to anon, authenticated, service_role;
