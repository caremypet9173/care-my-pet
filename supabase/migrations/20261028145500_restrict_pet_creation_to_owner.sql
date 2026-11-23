-- Migracja: ograniczenie uprawnień dodawania zwierząt wyłącznie do właściciela gospodarstwa
-- Współopiekunowie (członkowie gospodarstwa) mają uprawnienia do przeglądania, dodawania badań, wpisów i wizyt,
-- natomiast zarządzanie stadem (dodawanie nowych pupili) jest zarezerwowane dla właściciela.

-- 1. Aktualizacja funkcji create_pet
create or replace function public.create_pet(p_pet jsonb) returns public.zwierze
language plpgsql security invoker set search_path = '' as $$
declare
  home_id uuid;
  result public.zwierze;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Sprawdź czy caller posiada własne gospodarstwo jako właściciel
  select id into home_id from public.gospodarstwo where owner_id = caller;
  if home_id is null then
    raise exception 'Only household owner can add pets' using errcode = '42501';
  end if;

  insert into public.zwierze(gospodarstwo_id, imie, gatunek, rasa, data_urodzenia, plec,
    kastracja, identyfikacja, numer_id, notatki, created_by, updated_by, data_urodzenia_przyblizona, avatar_path)
  values (home_id, p_pet->>'imie', p_pet->>'gatunek', p_pet->>'rasa',
    (p_pet->>'data_urodzenia')::date, p_pet->>'plec', (p_pet->>'kastracja')::boolean,
    p_pet->>'identyfikacja', p_pet->>'numer_id', p_pet->>'notatki', caller, caller,
    coalesce((p_pet->>'data_urodzenia_przyblizona')::boolean,false), p_pet->>'avatar_path')
  returning * into result;
  return result;
end;
$$;

-- 2. Aktualizacja polityki RLS pet_create
drop policy if exists pet_create on public.zwierze;
create policy pet_create on public.zwierze for insert to authenticated
  with check (
    gospodarstwo_id in (select id from public.gospodarstwo where owner_id = (select auth.uid()))
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );
