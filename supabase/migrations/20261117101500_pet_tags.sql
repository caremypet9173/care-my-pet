-- Migracja: dodanie tagów (krótkich haseł opiekuńczo-zdrowotnych) do profilu zwierzaka.

alter table public.zwierze
  add column if not exists tagi text[] not null default '{}';

alter table public.zwierze
  drop constraint if exists zwierze_tagi_count,
  drop constraint if exists zwierze_tagi_no_nulls,
  drop constraint if exists zwierze_tagi_total_length;

alter table public.zwierze
  add constraint zwierze_tagi_count check (cardinality(tagi) <= 8),
  add constraint zwierze_tagi_no_nulls check (array_position(tagi, null) is null),
  add constraint zwierze_tagi_total_length check (char_length(array_to_string(tagi, '')) <= 320);

create or replace function public.create_pet(p_pet jsonb) returns public.zwierze
language plpgsql security invoker set search_path = '' as $$
declare
  home_id uuid;
  result public.zwierze;
  caller uuid := auth.uid();
  pet_tags text[];
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Sprawdź czy caller posiada własne gospodarstwo jako właściciel
  select id into home_id from public.gospodarstwo where owner_id = caller;
  if home_id is null then
    raise exception 'Only household owner can add pets' using errcode = '42501';
  end if;

  select coalesce(array_agg(clean_tag), '{}'::text[])
  into pet_tags
  from (
    select btrim(elem) as clean_tag
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(p_pet->'tagi') = 'array' then p_pet->'tagi'
        else '[]'::jsonb
      end
    ) as t(elem)
    where btrim(elem) <> ''
  ) normalized;

  insert into public.zwierze(
    gospodarstwo_id, imie, gatunek, rasa, data_urodzenia, plec,
    kastracja, identyfikacja, numer_id, notatki, tagi,
    created_by, updated_by, data_urodzenia_przyblizona, avatar_path
  )
  values (
    home_id, p_pet->>'imie', p_pet->>'gatunek', p_pet->>'rasa',
    (p_pet->>'data_urodzenia')::date, p_pet->>'plec', (p_pet->>'kastracja')::boolean,
    p_pet->>'identyfikacja', p_pet->>'numer_id', p_pet->>'notatki', pet_tags,
    caller, caller,
    coalesce((p_pet->>'data_urodzenia_przyblizona')::boolean, false), p_pet->>'avatar_path'
  )
  returning * into result;
  return result;
end;
$$;
