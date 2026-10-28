-- Migracja naprawcza: usunięcie rekurencji RLS (42P17) pomiędzy gospodarstwo a czlonek_gospodarstwa
-- Poprzez wprowadzenie funkcji security definer omijającej RLS przy sprawdzaniu uprawnień do gospodarstwa.

-- 1. Funkcja zwracająca identyfikatory gospodarstw, do których użytkownik ma dostęp
create or replace function public.get_user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.gospodarstwo where owner_id = (select auth.uid())
  union
  select gospodarstwo_id from public.czlonek_gospodarstwa where user_id = (select auth.uid());
$$;

revoke all on function public.get_user_household_ids() from public, anon;
grant execute on function public.get_user_household_ids() to authenticated;
grant execute on function public.get_user_household_ids() to service_role;

-- 2. Funkcja pomocnicza sprawdzająca, czy użytkownik jest właścicielem danego gospodarstwa
create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gospodarstwo
    where id = p_household_id and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_owner(uuid) from public, anon;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to service_role;

-- 3. Aktualizacja polityki SELECT dla gospodarstwo
drop policy if exists household_read on public.gospodarstwo;
create policy household_read on public.gospodarstwo for select to authenticated
  using (id in (select public.get_user_household_ids()));

-- 4. Aktualizacja polityk RLS dla czlonek_gospodarstwa
drop policy if exists own_membership on public.czlonek_gospodarstwa;
drop policy if exists membership_select on public.czlonek_gospodarstwa;
drop policy if exists membership_insert on public.czlonek_gospodarstwa;
drop policy if exists membership_update on public.czlonek_gospodarstwa;
drop policy if exists membership_delete on public.czlonek_gospodarstwa;

create policy membership_select on public.czlonek_gospodarstwa for select to authenticated
  using (
    user_id = (select auth.uid())
    or gospodarstwo_id in (select public.get_user_household_ids())
  );

create policy membership_insert on public.czlonek_gospodarstwa for insert to authenticated
  with check (public.is_household_owner(gospodarstwo_id));

create policy membership_update on public.czlonek_gospodarstwa for update to authenticated
  using (public.is_household_owner(gospodarstwo_id));

create policy membership_delete on public.czlonek_gospodarstwa for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_household_owner(gospodarstwo_id)
  );

-- 5. Aktualizacja polityk RLS dla zaproszenie_gospodarstwa
drop policy if exists zaproszenie_select on public.zaproszenie_gospodarstwa;
drop policy if exists zaproszenie_insert on public.zaproszenie_gospodarstwa;
drop policy if exists zaproszenie_update on public.zaproszenie_gospodarstwa;
drop policy if exists zaproszenie_delete on public.zaproszenie_gospodarstwa;

create policy zaproszenie_select on public.zaproszenie_gospodarstwa for select to authenticated
  using (
    gospodarstwo_id in (select public.get_user_household_ids())
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy zaproszenie_insert on public.zaproszenie_gospodarstwa for insert to authenticated
  with check (
    public.is_household_owner(gospodarstwo_id)
    and created_by = (select auth.uid())
  );

create policy zaproszenie_update on public.zaproszenie_gospodarstwa for update to authenticated
  using (
    public.is_household_owner(gospodarstwo_id)
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy zaproszenie_delete on public.zaproszenie_gospodarstwa for delete to authenticated
  using (public.is_household_owner(gospodarstwo_id));
