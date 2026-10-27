create table private.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.gospodarstwo(id) on delete set null,
  pet_id uuid references public.zwierze(id) on delete set null,
  feature text not null check (feature in ('medical_report', 'health_event')),
  model text not null check (char_length(model) between 1 and 80),
  mime_type text not null check (char_length(mime_type) between 1 and 60),
  file_size_bytes integer not null check (file_size_bytes >= 0),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  thoughts_tokens integer not null default 0 check (thoughts_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null check (status in ('ok', 'http_error', 'invalid_output')),
  http_status integer
);

create index ai_usage_log_created_idx on private.ai_usage_log(created_at desc);
create index ai_usage_log_feature_model_idx on private.ai_usage_log(feature, model);
create index ai_usage_log_user_idx on private.ai_usage_log(user_id, created_at desc);

alter table private.ai_usage_log enable row level security;
revoke all on private.ai_usage_log from public, anon, authenticated;

create function private.calculate_gemini_cost_usd(
  p_model text,
  p_prompt_tokens integer,
  p_output_tokens integer,
  p_thoughts_tokens integer
) returns numeric(12, 6) language plpgsql immutable set search_path = '' as $$
declare
  input_rate numeric(10, 4);
  output_rate numeric(10, 4);
  billed_output integer := greatest(coalesce(p_output_tokens, 0), 0) + greatest(coalesce(p_thoughts_tokens, 0), 0);
  billed_input integer := greatest(coalesce(p_prompt_tokens, 0), 0);
begin
  case
    when p_model like 'gemini-3.1-flash-lite%' then
      input_rate := 0.25; output_rate := 1.50;
    when p_model like 'gemini-3.5-flash-lite%' then
      input_rate := 0.30; output_rate := 2.50;
    when p_model like 'gemini-2.5-flash-lite%' then
      input_rate := 0.10; output_rate := 0.40;
    when p_model like 'gemini-2.5-flash%' then
      input_rate := 0.30; output_rate := 2.50;
    when p_model like 'gemini-3-flash%' or p_model like 'gemini-3.6-flash%' or p_model like 'gemini-3.8-flash%' then
      input_rate := 0.75; output_rate := 3.75;
    when p_model like 'gemini-3.1-pro%' or p_model like 'gemini-2.5-pro%' or p_model like 'gemini-3-pro%' then
      input_rate := 2.00; output_rate := 12.00;
    else
      input_rate := 0.50; output_rate := 3.00;
  end case;

  return round(
    (billed_input::numeric * input_rate / 1000000.0) +
    (billed_output::numeric * output_rate / 1000000.0),
    6
  );
end $$;

revoke all on function private.calculate_gemini_cost_usd(text, integer, integer, integer) from public, anon, authenticated;

create function private.log_ai_usage(
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
      where g.wlasciciel_id = auth.uid()
         or exists (
           select 1 from public.czlonek_gospodarstwa c
           where c.gospodarstwo_id = g.id and c.uzytkownik_id = auth.uid()
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

create function public.log_ai_usage(
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
) returns void language sql security invoker set search_path = '' as $$
  select private.log_ai_usage(
    p_pet_id,
    p_feature,
    p_model,
    p_mime_type,
    p_file_size_bytes,
    p_prompt_tokens,
    p_output_tokens,
    p_thoughts_tokens,
    p_total_tokens,
    p_duration_ms,
    p_status,
    p_http_status
  );
$$;

revoke all on function public.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer) from public, anon;
grant execute on function public.log_ai_usage(uuid, text, text, text, integer, integer, integer, integer, integer, integer, text, integer) to authenticated;

create view private.ai_cost_summary with (security_invoker = true) as
select
  to_char(created_at at time zone 'UTC', 'YYYY-MM') as month_utc,
  feature,
  model,
  count(*) as requests_total,
  count(*) filter (where status = 'ok') as requests_ok,
  count(*) filter (where status <> 'ok') as requests_failed,
  sum(prompt_tokens) as prompt_tokens,
  sum(output_tokens) as output_tokens,
  sum(thoughts_tokens) as thoughts_tokens,
  sum(total_tokens) as total_tokens,
  round(sum(estimated_cost_usd), 6) as total_cost_usd,
  round(avg(estimated_cost_usd), 6) as avg_cost_per_request_usd,
  round(avg(duration_ms))::integer as avg_duration_ms
from private.ai_usage_log
group by 1, 2, 3
order by 1 desc, 2, 3;

revoke all on private.ai_cost_summary from public, anon, authenticated;
