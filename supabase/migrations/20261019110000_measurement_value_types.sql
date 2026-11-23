create function public.is_decimal_measurement(p_value text) returns boolean
language sql immutable set search_path='' as $$
 select btrim(p_value) ~ '^([<>]=?|[≤≥])?[[:space:]]*[+-]?[0-9]+([.,][0-9]+)?$';
$$;
alter table public.pomiar_parametru add column value_type text generated always as (
 case when public.is_decimal_measurement(value) or public.is_decimal_measurement(reference)
 or btrim(reference) ~ '^[+-]?[0-9]+([.,][0-9]+)?[[:space:]]*[-–—][[:space:]]*[+-]?[0-9]+([.,][0-9]+)?$'
 then 'decimal' else 'text' end
) stored;
-- Existing source strings remain intact. New numeric results require valid syntax.
alter table public.pomiar_parametru add constraint measurement_value_type_valid
 check(value_type='text' or public.is_decimal_measurement(value)) not valid;
create function public.validate_measurement_correction_type() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.pomiar_parametru where id=new.measurement_id and value_type='decimal')
 and not public.is_decimal_measurement(new.value) then
  raise exception 'Numeric parameter requires a numeric value' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function public.validate_measurement_correction_type() from public,anon,authenticated;
create trigger correction_value_type before insert or update on public.measurement_correction
for each row execute function public.validate_measurement_correction_type();
