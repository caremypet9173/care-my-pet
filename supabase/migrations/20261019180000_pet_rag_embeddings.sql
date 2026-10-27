create extension if not exists vector with schema extensions;

alter table private.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check,
  add constraint ai_usage_log_feature_check check (
    feature in ('medical_report', 'health_event', 'embedding', 'ai_assistant')
  );

create or replace function private.calculate_gemini_cost_usd(
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
    when p_model like 'gemini-embedding%' then
      input_rate := 0.20; output_rate := 0.00;
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

create table public.pet_knowledge_chunk (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  source_type text not null check (source_type in ('medical_report', 'health_event')),
  source_id uuid not null,
  event_date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create index pet_knowledge_chunk_pet_idx on public.pet_knowledge_chunk(pet_id, event_date desc);
create index pet_knowledge_chunk_household_idx on public.pet_knowledge_chunk(household_id);
create index pet_knowledge_chunk_embedding_idx on public.pet_knowledge_chunk
  using hnsw (embedding extensions.vector_cosine_ops);

grant select on public.pet_knowledge_chunk to anon;
grant select, insert, update, delete on public.pet_knowledge_chunk to authenticated;
grant select, insert, update, delete on public.pet_knowledge_chunk to service_role;

alter table public.pet_knowledge_chunk enable row level security;

create policy pet_knowledge_read on public.pet_knowledge_chunk
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy pet_knowledge_write on public.pet_knowledge_chunk
  for all to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create function public.cleanup_pet_knowledge_chunk() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'wynik_badania' then
    delete from public.pet_knowledge_chunk where source_type = 'medical_report' and source_id = old.id;
  elsif tg_table_name = 'pet_health_event' then
    delete from public.pet_knowledge_chunk where source_type = 'health_event' and source_id = old.id;
  end if;
  return old;
end $$;

revoke all on function public.cleanup_pet_knowledge_chunk() from public, anon, authenticated;

create trigger cleanup_report_knowledge_chunk
  after delete on public.wynik_badania
  for each row execute function public.cleanup_pet_knowledge_chunk();

create trigger cleanup_event_knowledge_chunk
  after delete on public.pet_health_event
  for each row execute function public.cleanup_pet_knowledge_chunk();

create function public.upsert_pet_knowledge_chunk(
  p_pet_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_event_date date,
  p_title text,
  p_content text,
  p_embedding text
) returns uuid language plpgsql security invoker set search_path = 'extensions' as $$
declare
  v_household_id uuid;
  v_chunk_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select gospodarstwo_id into strict v_household_id
  from public.zwierze
  where id = p_pet_id;

  insert into public.pet_knowledge_chunk (
    pet_id,
    household_id,
    source_type,
    source_id,
    event_date,
    title,
    content,
    embedding,
    updated_at
  ) values (
    p_pet_id,
    v_household_id,
    p_source_type,
    p_source_id,
    p_event_date,
    left(btrim(p_title), 200),
    left(btrim(p_content), 12000),
    p_embedding::extensions.vector(768),
    now()
  )
  on conflict (source_type, source_id) do update
  set event_date = excluded.event_date,
      title = excluded.title,
      content = excluded.content,
      embedding = excluded.embedding,
      updated_at = now()
  returning id into v_chunk_id;

  return v_chunk_id;
end $$;

revoke all on function public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text) from public, anon;
grant execute on function public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text) to authenticated;

create function public.match_pet_knowledge(
  p_pet_id uuid,
  p_query_embedding text,
  p_match_count integer default 5
) returns table (
  id uuid,
  source_type text,
  source_id uuid,
  event_date date,
  title text,
  content text,
  similarity double precision
) language sql stable security invoker set search_path = 'extensions' as $$
  select
    c.id,
    c.source_type,
    c.source_id,
    c.event_date,
    c.title,
    c.content,
    1 - (c.embedding <=> (p_query_embedding::extensions.vector(768))) as similarity
  from public.pet_knowledge_chunk c
  where c.pet_id = p_pet_id
  order by c.embedding <=> (p_query_embedding::extensions.vector(768))
  limit greatest(least(coalesce(p_match_count, 5), 20), 1);
$$;

revoke all on function public.match_pet_knowledge(uuid, text, integer) from public, anon;
grant execute on function public.match_pet_knowledge(uuid, text, integer) to authenticated;
