-- ==============================================================================
-- Migracja: fix_household_insert_rls_and_pilot_oauth_gate
-- 1. Naprawa polityki SELECT (household_read) na public.gospodarstwo:
--    Dodanie bezposredniego warunku `owner_id = (select auth.uid())`, aby
--    INSERT ... RETURNING (PostgREST `.insert(...).select(...)`) dla nowo
--    tworzonego domostwa nie byl odrzucany bledem RLS 42501 przez snapshot
--    funkcji STABLE `public.get_user_household_ids()`.
-- 2. Domkniecie bramki zamknietego pilotazu `public.check_pilot_access`:
--    Usuniecie warunku `or v_has_account` z uprawnienia `eligible`, ktory
--    pozwalal kazdemu nowemu uzytkownikowi Google OAuth ominac biala liste
--    (poniewaz OAuth tworzy wiersz w auth.users przed wywolaniem callbacka).
--    Zastapienie go bezpiecznym fallbackiem na posiadanie gospodarstwa lub
--    czlonkostwa (`gospodarstwo` / `czlonek_gospodarstwa`).
-- 3. Funkcja `public.cleanup_unauthorized_pilot_user()` do usuwania swiezo
--    utworzonych osieroconych kont z auth.users po odrzuceniu na bramce OAuth.
-- ==============================================================================

-- 1. Polityka SELECT na public.gospodarstwo (bez rekurencji, dziala z INSERT ... RETURNING)
drop policy if exists household_read on public.gospodarstwo;
create policy household_read on public.gospodarstwo
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or id in (select public.get_user_household_ids())
  );

-- 2. Domkniecie check_pilot_access (brak obejscia przez sam wpis w auth.users)
create or replace function public.check_pilot_access(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text := lower(btrim(p_email));
  v_is_whitelisted boolean := false;
  v_has_invitation boolean := false;
  v_has_recovery boolean := false;
  v_has_account boolean := false;
  v_has_household_access boolean := false;
begin
  if v_norm is null or v_norm = '' or v_norm !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return jsonb_build_object('eligible', false, 'reason', 'invalid_email');
  end if;

  select exists(
    select 1 from public.pilot_whitelist where lower(email) = v_norm
  ) into v_is_whitelisted;

  select exists(
    select 1
    from public.zaproszenie_gospodarstwa
    where lower(email) = v_norm
      and status in ('pending', 'accepted')
  ) into v_has_invitation;

  select exists(
    select 1
    from private.household_recovery_claim
    where lower(target_email) = v_norm
      and confirmed_at is null
      and revoked_at is null
      and expires_at > now()
  ) into v_has_recovery;

  select exists(
    select 1 from auth.users where lower(email) = v_norm
  ) into v_has_account;

  select exists(
    select 1
    from auth.users u
    where lower(u.email) = v_norm
      and (
        exists(select 1 from public.gospodarstwo g where g.owner_id = u.id)
        or exists(select 1 from public.czlonek_gospodarstwa c where c.user_id = u.id)
      )
  ) into v_has_household_access;

  if v_is_whitelisted or v_has_invitation or v_has_recovery or v_has_household_access then
    return jsonb_build_object(
      'eligible', true,
      'has_account', v_has_account,
      'is_invitation', (v_has_invitation or v_has_recovery) and not v_is_whitelisted
    );
  else
    return jsonb_build_object(
      'eligible', false,
      'reason', 'not_whitelisted'
    );
  end if;
end;
$$;

revoke all on function public.check_pilot_access(text) from public, anon;
grant execute on function public.check_pilot_access(text) to anon, authenticated, service_role;

-- 3. Sprzatanie swiezo utworzonego konta spoza pilotazu po odrzuceniu w callbacku OAuth/OTP
create or replace function public.cleanup_unauthorized_pilot_user()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_created_at timestamptz;
  v_is_whitelisted boolean := false;
  v_has_invitation boolean := false;
  v_has_recovery boolean := false;
  v_has_household_access boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  select lower(btrim(coalesce(u.email, ''))), u.created_at
  into v_email, v_created_at
  from auth.users u
  where u.id = v_uid;

  if v_created_at is null or v_created_at < now() - interval '15 minutes' then
    return false;
  end if;

  if v_email <> '' then
    select exists(
      select 1 from public.pilot_whitelist where lower(email) = v_email
    ) into v_is_whitelisted;

    select exists(
      select 1
      from public.zaproszenie_gospodarstwa
      where lower(email) = v_email
        and status in ('pending', 'accepted')
    ) into v_has_invitation;

    select exists(
      select 1
      from private.household_recovery_claim
      where lower(target_email) = v_email
        and confirmed_at is null
        and revoked_at is null
        and expires_at > now()
    ) into v_has_recovery;
  end if;

  select (
    exists(select 1 from public.gospodarstwo g where g.owner_id = v_uid)
    or exists(select 1 from public.czlonek_gospodarstwa c where c.user_id = v_uid)
  ) into v_has_household_access;

  if v_is_whitelisted or v_has_invitation or v_has_recovery or v_has_household_access then
    return false;
  end if;

  delete from auth.users where id = v_uid;
  return found;
end;
$$;

revoke all on function public.cleanup_unauthorized_pilot_user() from public, anon;
grant execute on function public.cleanup_unauthorized_pilot_user() to authenticated, service_role;
