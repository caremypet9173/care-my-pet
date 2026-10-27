-- Fix RLS on private.ai_usage_log and private.ai_cost_summary for Supabase Studio SQL Editor (postgres role)
-- and add diagnostic / fix for log_ai_usage RPC

alter table private.ai_usage_log disable row level security;

create or replace view private.ai_cost_summary as
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
