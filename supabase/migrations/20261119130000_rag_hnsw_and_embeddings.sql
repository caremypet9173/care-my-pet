-- ==============================================================================
-- Migracja: rag_hnsw_and_embeddings (Pakiet 2)
-- 1. Kolumny embedding_model + content_sha256 na public.pet_knowledge_chunk
--    (eliminacja zbędnych ponownych wywołań Gemini Embedding API oraz izolacja
--    przestrzeni wektorowej przy zmianie modelu embeddingów)
-- 2. Rozdzielenie nakładających się permissive RLS policies na pet_knowledge_chunk
--    (P1.1: usunięcie FOR ALL nakładającego się na FOR SELECT + użycie
--    get_user_household_ids())
-- 3. Aktualizacja upsert_pet_knowledge_chunk (zapis modelu i SHA-256)
-- 4. Aktualizacja match_pet_knowledge: pgvector 0.8.2 hnsw.iterative_scan =
--    relaxed_order (eliminacja zjawiska "pustego recall" przy filtrze pet_id
--    na indeksie HNSW) + jednorazowe rzutowanie wektora + opcjonalny filtr modelu
-- ==============================================================================

alter table public.pet_knowledge_chunk
  add column if not exists embedding_model text not null default 'gemini-embedding-001',
  add column if not exists content_sha256 text;

-- Rozłączne polityki RLS (bez dublowania FOR SELECT i FOR ALL)
drop policy if exists pet_knowledge_read on public.pet_knowledge_chunk;
drop policy if exists pet_knowledge_write on public.pet_knowledge_chunk;
drop policy if exists pet_knowledge_insert on public.pet_knowledge_chunk;
drop policy if exists pet_knowledge_update on public.pet_knowledge_chunk;
drop policy if exists pet_knowledge_delete on public.pet_knowledge_chunk;

create policy pet_knowledge_read on public.pet_knowledge_chunk
  for select to authenticated
  using (household_id in (select public.get_user_household_ids()));

create policy pet_knowledge_insert on public.pet_knowledge_chunk
  for insert to authenticated
  with check (household_id in (select public.get_user_household_ids()));

create policy pet_knowledge_update on public.pet_knowledge_chunk
  for update to authenticated
  using (household_id in (select public.get_user_household_ids()))
  with check (household_id in (select public.get_user_household_ids()));

create policy pet_knowledge_delete on public.pet_knowledge_chunk
  for delete to authenticated
  using (household_id in (select public.get_user_household_ids()));

-- Aktualizacja upsert_pet_knowledge_chunk bez niejednoznacznego przeciążenia
drop function if exists public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text);
drop function if exists public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text, text, text);

create function public.upsert_pet_knowledge_chunk(
  p_pet_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_event_date date,
  p_title text,
  p_content text,
  p_embedding text,
  p_embedding_model text default 'gemini-embedding-001',
  p_content_sha256 text default null
) returns uuid
language plpgsql
security invoker
set search_path = 'extensions'
as $$
declare
  v_household_id uuid;
  v_chunk_id uuid;
  v_model text := coalesce(nullif(btrim(coalesce(p_embedding_model, '')), ''), 'gemini-embedding-001');
  v_sha256 text := nullif(btrim(coalesce(p_content_sha256, '')), '');
begin
  if (select auth.uid()) is null then
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
    embedding_model,
    content_sha256,
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
    v_model,
    v_sha256,
    now()
  )
  on conflict (source_type, source_id) do update
  set event_date = excluded.event_date,
      title = excluded.title,
      content = excluded.content,
      embedding = excluded.embedding,
      embedding_model = excluded.embedding_model,
      content_sha256 = excluded.content_sha256,
      updated_at = now()
  returning id into v_chunk_id;

  return v_chunk_id;
end;
$$;

revoke all on function public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text, text, text) from public, anon;
grant execute on function public.upsert_pet_knowledge_chunk(uuid, text, uuid, date, text, text, text, text, text) to authenticated, service_role;

-- Aktualizacja match_pet_knowledge z hnsw.iterative_scan (pgvector 0.8.2)
drop function if exists public.match_pet_knowledge(uuid, text, integer);
drop function if exists public.match_pet_knowledge(uuid, text, integer, text);

create function public.match_pet_knowledge(
  p_pet_id uuid,
  p_query_embedding text,
  p_match_count integer default 5,
  p_embedding_model text default null
) returns table (
  id uuid,
  source_type text,
  source_id uuid,
  event_date date,
  title text,
  content text,
  similarity double precision
)
language plpgsql
volatile
security invoker
set search_path = 'extensions'
as $$
declare
  v_query extensions.vector(768) := p_query_embedding::extensions.vector(768);
  v_limit integer := greatest(least(coalesce(p_match_count, 5), 20), 1);
  v_model text := nullif(btrim(coalesce(p_embedding_model, '')), '');
begin
  -- pgvector 0.8+: iteracyjne skanowanie HNSW przy filtrowaniu po pet_id (multi-tenant)
  perform pg_catalog.set_config('hnsw.iterative_scan', 'relaxed_order', true);

  return query
  select
    c.id,
    c.source_type,
    c.source_id,
    c.event_date,
    c.title,
    c.content,
    (1 - (c.embedding <=> v_query))::double precision as similarity
  from public.pet_knowledge_chunk c
  where c.pet_id = p_pet_id
    and (v_model is null or c.embedding_model = v_model)
  order by c.embedding <=> v_query
  limit v_limit;
end;
$$;

revoke all on function public.match_pet_knowledge(uuid, text, integer, text) from public, anon;
grant execute on function public.match_pet_knowledge(uuid, text, integer, text) to authenticated, service_role;
