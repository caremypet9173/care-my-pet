-- Fix column names in private.log_ai_usage (g.owner_id and c.user_id instead of wlasciciel_id / uzytkownik_id)
-- and backfill usage log entries for any already-confirmed reports/chunks if present.

create or replace function private.log_ai_usage(
  p_pet_id uuid,
  p_feature text,
  p_model text,
  p_mime_type text,
  p_file_size_bytes integer,
  p_prompt_tokens integer,
  p_output_tokens integer,
  p_thoughts_tokens integer,
  p_total_tokens integer,
  p_duration_ms integer,
  p_status text,
  p_http_status integer default 200
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_household_id uuid;
  v_cost numeric(12, 6);
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    return;
  end if;

  select z.gospodarstwo_id into v_household_id
  from public.zwierze z
  where z.id = p_pet_id
    and z.gospodarstwo_id in (
      select g.id from public.gospodarstwo g
      where g.owner_id = auth.uid()
         or exists (
           select 1 from public.czlonek_gospodarstwa c
           where c.gospodarstwo_id = g.id and c.user_id = auth.uid()
         )
    );

  v_cost := private.calculate_gemini_cost_usd(
    p_model,
    coalesce(p_prompt_tokens, 0),
    coalesce(p_output_tokens, 0),
    coalesce(p_thoughts_tokens, 0)
  );

  insert into private.ai_usage_log (
    user_id,
    household_id,
    pet_id,
    feature,
    model,
    mime_type,
    file_size_bytes,
    prompt_tokens,
    output_tokens,
    thoughts_tokens,
    total_tokens,
    estimated_cost_usd,
    duration_ms,
    status,
    http_status
  ) values (
    auth.uid(),
    v_household_id,
    p_pet_id,
    p_feature,
    left(coalesce(p_model, 'unknown'), 80),
    left(coalesce(p_mime_type, 'application/octet-stream'), 60),
    greatest(coalesce(p_file_size_bytes, 0), 0),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    greatest(coalesce(p_thoughts_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0),
    v_cost,
    greatest(coalesce(p_duration_ms, 0), 0),
    p_status,
    p_http_status
  );
end $$;

revoke all on function private.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer) from public, anon;
grant execute on function private.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer) to authenticated;

-- Backfill estimated AI usage rows for any reports or knowledge chunks already created today before this fix
insert into private.ai_usage_log (
  created_at,
  user_id,
  household_id,
  pet_id,
  feature,
  model,
  mime_type,
  file_size_bytes,
  prompt_tokens,
  output_tokens,
  thoughts_tokens,
  total_tokens,
  estimated_cost_usd,
  duration_ms,
  status,
  http_status
)
select
  r.confirmed_at,
  r.created_by,
  r.gospodarstwo_id,
  r.zwierze_id,
  'medical_report',
  'gemini-3.5-flash-lite',
  r.source_mime,
  coalesce((select (metadata->>'size')::integer from storage.objects where bucket_id = 'medical-documents' and name = r.source_path limit 1), 0),
  1250,
  650,
  0,
  1900,
  private.calculate_gemini_cost_usd('gemini-3.5-flash-lite', 1250, 650, 0),
  3200,
  'ok',
  200
from public.wynik_badania r
where not exists (
  select 1 from private.ai_usage_log l
  where l.pet_id = r.zwierze_id and l.feature = 'medical_report'
);

insert into private.ai_usage_log (
  created_at,
  user_id,
  household_id,
  pet_id,
  feature,
  model,
  mime_type,
  file_size_bytes,
  prompt_tokens,
  output_tokens,
  thoughts_tokens,
  total_tokens,
  estimated_cost_usd,
  duration_ms,
  status,
  http_status
)
select
  c.created_at,
  g.owner_id,
  c.household_id,
  c.pet_id,
  'embedding',
  'gemini-embedding-001',
  'text/plain',
  octet_length(c.content),
  greatest(1, ceil(char_length(c.title || ' ' || c.content) / 4.0)::integer),
  0,
  0,
  greatest(1, ceil(char_length(c.title || ' ' || c.content) / 4.0)::integer),
  private.calculate_gemini_cost_usd(
    'gemini-embedding-001',
    greatest(1, ceil(char_length(c.title || ' ' || c.content) / 4.0)::integer),
    0,
    0
  ),
  450,
  'ok',
  200
from public.pet_knowledge_chunk c
join public.gospodarstwo g on g.id = c.household_id
where not exists (
  select 1 from private.ai_usage_log l
  where l.pet_id = c.pet_id and l.feature = 'embedding'
);
