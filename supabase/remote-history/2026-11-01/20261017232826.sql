-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A08 only sees material exposed by search_knowledge. Keep aggregate counts,
-- candidate pairs and the model catalog aligned with that audience boundary.
create or replace function public.ai_knowledge_catalog_coverage(target_organization_id uuid)
returns table (
  active_documents bigint,
  global_documents bigint,
  organization_documents bigint,
  indexed_documents bigint,
  documents_pending_index bigint,
  documents_without_chunks bigint,
  total_chunks bigint,
  chunks_without_embeddings bigint,
  audience_counts jsonb,
  latest_document_updated_at timestamptz
)
language sql stable set search_path = pg_catalog, public
as $$
  with docs as (
    select d.id, d.visibility, d.audience, d.updated_at
    from public.knowledge_documents d
    where d.status = 'active' and d.audience = 'client_visible'
      and (d.visibility = 'global' or d.organization_id = target_organization_id)
  ), chunk_counts as (
    select c.document_id, count(*)::bigint as chunks,
      count(*) filter (where c.embedding is null)::bigint as chunks_pending
    from public.knowledge_chunks c join docs d on d.id = c.document_id
    group by c.document_id
  ), audience_totals as (
    select d.audience, count(*)::bigint as documents from docs d group by d.audience
  )
  select count(*)::bigint,
    count(*) filter (where d.visibility = 'global')::bigint,
    count(*) filter (where d.visibility = 'organization')::bigint,
    count(*) filter (where coalesce(c.chunks, 0) > 0 and coalesce(c.chunks_pending, 0) = 0)::bigint,
    count(*) filter (where coalesce(c.chunks_pending, 0) > 0)::bigint,
    count(*) filter (where coalesce(c.chunks, 0) = 0)::bigint,
    coalesce(sum(c.chunks), 0)::bigint,
    coalesce(sum(c.chunks_pending), 0)::bigint,
    coalesce((select jsonb_object_agg(a.audience, a.documents) from audience_totals a), '{}'::jsonb),
    max(d.updated_at)
  from docs d left join chunk_counts c on c.document_id = d.id;
$$;
revoke all on function public.ai_knowledge_catalog_coverage(uuid) from public, anon, authenticated;
grant execute on function public.ai_knowledge_catalog_coverage(uuid) to service_role;

create or replace function public.organization_knowledge_digest(target_organization_id uuid)
returns text
language sql stable set search_path = pg_catalog, public
as $$
  select md5(coalesce(string_agg(
    concat_ws(':', d.id::text, d.version::text, d.checksum, d.updated_at::text,
      coalesce(d.store_id::text, ''), coalesce(c.chunk_count, 0)::text,
      coalesce(c.missing_embeddings, 0)::text), '|'
    order by d.id
  ), ''))
  from public.knowledge_documents d
  left join lateral (
    select count(*)::bigint as chunk_count,
      count(*) filter (where kc.embedding is null)::bigint as missing_embeddings
    from public.knowledge_chunks kc where kc.document_id = d.id
  ) c on true
  where d.status = 'active' and d.audience = 'client_visible'
    and (d.visibility = 'global' or d.organization_id = target_organization_id);
$$;
revoke all on function public.organization_knowledge_digest(uuid) from public, anon, authenticated;
grant execute on function public.organization_knowledge_digest(uuid) to service_role;

-- Replace content and its vector chunks in one transaction. The version check
-- prevents two concurrent editors from overwriting each other's embeddings.
create or replace function public.replace_knowledge_document_index(
  p_document_id uuid,
  p_expected_version integer,
  p_content text,
  p_checksum text,
  p_embedding_model text,
  p_chunks jsonb
)
returns boolean
language plpgsql set search_path = pg_catalog, public, extensions
as $$
declare
  v_organization_id uuid;
begin
  if p_content is null or length(trim(p_content)) = 0
     or p_checksum is null or p_embedding_model is null
     or jsonb_typeof(p_chunks) <> 'array'
     or jsonb_array_length(p_chunks) < 1
     or jsonb_array_length(p_chunks) > 500 then
    raise exception 'invalid_knowledge_document_index' using errcode = '22023';
  end if;

  update public.knowledge_documents
  set content = p_content, checksum = p_checksum,
      embedding_model = p_embedding_model, version = version + 1
  where id = p_document_id and version = p_expected_version
  returning organization_id into v_organization_id;
  if not found then return false; end if;

  delete from public.knowledge_chunks where document_id = p_document_id;
  insert into public.knowledge_chunks
    (document_id, organization_id, chunk_index, content, token_count, embedding)
  select p_document_id, v_organization_id, x.chunk_index, x.content,
      x.token_count, x.embedding::extensions.vector(1024)
  from jsonb_to_recordset(p_chunks) as x(
    chunk_index integer, content text, token_count integer, embedding text
  ) order by x.chunk_index;
  return true;
end;
$$;
revoke all on function public.replace_knowledge_document_index(uuid, integer, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_knowledge_document_index(uuid, integer, text, text, text, jsonb)
  to service_role;

create or replace function public.create_knowledge_document_index(
  p_organization_id uuid, p_store_id uuid, p_title text, p_description text,
  p_source_type text, p_visibility text, p_audience text, p_content text,
  p_checksum text, p_embedding_model text, p_created_by uuid, p_chunks jsonb
)
returns table (id uuid, title varchar, visibility varchar, audience varchar, version integer)
language plpgsql set search_path = pg_catalog, public, extensions
as $$
declare
  v_document_id uuid;
begin
  if p_title is null or length(trim(p_title)) = 0
     or p_content is null or length(trim(p_content)) = 0
     or p_visibility not in ('global', 'organization')
     or p_audience not in ('client_visible', 'consultant_only', 'system_only')
     or jsonb_typeof(p_chunks) <> 'array'
     or jsonb_array_length(p_chunks) < 1
     or jsonb_array_length(p_chunks) > 500 then
    raise exception 'invalid_knowledge_document_index' using errcode = '22023';
  end if;
  if (p_visibility = 'global' and p_organization_id is not null)
     or (p_visibility = 'organization' and p_organization_id is null) then
    raise exception 'invalid_knowledge_document_scope' using errcode = '22023';
  end if;

  insert into public.knowledge_documents
    (organization_id, store_id, title, description, source_type, visibility,
     audience, content, checksum, embedding_model, created_by)
  values
    (p_organization_id, p_store_id, left(trim(p_title), 255), p_description,
     p_source_type, p_visibility, p_audience, p_content, p_checksum,
     p_embedding_model, p_created_by)
  returning knowledge_documents.id into v_document_id;

  insert into public.knowledge_chunks
    (document_id, organization_id, chunk_index, content, token_count, embedding)
  select v_document_id, p_organization_id, x.chunk_index, x.content,
      x.token_count, x.embedding::extensions.vector(1024)
  from jsonb_to_recordset(p_chunks) as x(
    chunk_index integer, content text, token_count integer, embedding text
  ) order by x.chunk_index;

  return query select d.id, d.title, d.visibility, d.audience, d.version
    from public.knowledge_documents d where d.id = v_document_id;
end;
$$;
revoke all on function public.create_knowledge_document_index(uuid, uuid, text, text, text, text, text, text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_knowledge_document_index(uuid, uuid, text, text, text, text, text, text, text, text, uuid, jsonb)
  to service_role;

drop function if exists public.ai_knowledge_semantic_candidates(uuid, integer, integer);
create function public.ai_knowledge_semantic_candidates(
  target_organization_id uuid,
  source_document_limit integer default 12,
  max_candidates integer default 30
)
returns table (
  source_document_id uuid, source_title varchar, source_visibility varchar,
  source_audience varchar, source_updated_at timestamptz,
  candidate_document_id uuid, candidate_title varchar,
  candidate_visibility varchar, candidate_audience varchar,
  candidate_updated_at timestamptz, semantic_similarity double precision
)
language sql stable set search_path = pg_catalog, public, extensions
as $$
  with scoped_documents as materialized (
    select d.id, d.title, d.visibility, d.audience, d.updated_at
    from public.knowledge_documents d
    where d.status = 'active' and d.audience = 'client_visible'
      and (d.visibility = 'global' or d.organization_id = target_organization_id)
  ), sampled_documents as (
    select d.* from scoped_documents d
    order by d.updated_at desc, d.id
    limit least(greatest(coalesce(source_document_limit, 12), 1), 20)
  ), sampled_chunks as (
    select d.id as source_id, d.title as source_title,
      d.visibility as source_visibility, d.audience as source_audience,
      d.updated_at as source_updated_at, c.embedding
    from sampled_documents d
    join lateral (
      select kc.embedding from public.knowledge_chunks kc
      where kc.document_id = d.id and kc.embedding is not null
      order by kc.chunk_index limit 3
    ) c on true
  ), nearest_pairs as (
    select s.source_id, s.source_title, s.source_visibility, s.source_audience,
      s.source_updated_at, n.candidate_id, n.candidate_title,
      n.candidate_visibility, n.candidate_audience, n.candidate_updated_at,
      n.similarity
    from sampled_chunks s
    cross join lateral (
      select d.id as candidate_id, d.title as candidate_title,
        d.visibility as candidate_visibility, d.audience as candidate_audience,
        d.updated_at as candidate_updated_at,
        greatest(1 - (c.embedding <=> s.embedding), 0)::double precision as similarity
      from public.knowledge_chunks c
      join scoped_documents d on d.id = c.document_id
      where c.embedding is not null and d.id <> s.source_id
        and d.visibility = s.source_visibility and d.audience = s.source_audience
      order by c.embedding <=> s.embedding, c.id limit 3
    ) n where n.similarity >= 0.82
  ), deduplicated_pairs as (
    select distinct on (least(source_id, candidate_id), greatest(source_id, candidate_id)) *
    from nearest_pairs
    order by least(source_id, candidate_id), greatest(source_id, candidate_id), similarity desc
  )
  select p.source_id, p.source_title, p.source_visibility, p.source_audience,
    p.source_updated_at, p.candidate_id, p.candidate_title,
    p.candidate_visibility, p.candidate_audience, p.candidate_updated_at,
    p.similarity
  from deduplicated_pairs p
  order by p.similarity desc, p.source_id, p.candidate_id
  limit least(greatest(coalesce(max_candidates, 30), 1), 50);
$$;
revoke all on function public.ai_knowledge_semantic_candidates(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ai_knowledge_semantic_candidates(uuid, integer, integer)
  to service_role;

create or replace function public.ai_knowledge_exact_document_evidence(
  target_organization_id uuid,
  target_document_ids uuid[]
)
returns table (
  document_id uuid, title varchar, visibility varchar, audience varchar,
  version integer, checksum varchar, store_id uuid, chunk_index integer,
  content text
)
language sql stable set search_path = pg_catalog, public
as $$
  select d.id, d.title, d.visibility, d.audience, d.version, d.checksum,
    d.store_id, c.chunk_index, left(c.content, 700)
  from public.knowledge_documents d
  join lateral (
    select kc.chunk_index, kc.content from public.knowledge_chunks kc
    where kc.document_id = d.id order by kc.chunk_index limit 1
  ) c on true
  where cardinality(target_document_ids) <= 24
    and d.id = any(target_document_ids)
    and d.status = 'active' and d.audience = 'client_visible'
    and (d.visibility = 'global' or d.organization_id = target_organization_id)
  order by d.id;
$$;
revoke all on function public.ai_knowledge_exact_document_evidence(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.ai_knowledge_exact_document_evidence(uuid, uuid[])
  to service_role;


