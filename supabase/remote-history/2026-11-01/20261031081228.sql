-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Separate service-role-only A08 audit RPCs. Legacy client-visible RPCs stay unchanged.
-- Shared global methodology is eligible; local private and foreign tenant material are not.

CREATE OR REPLACE FUNCTION public.ai_knowledge_audit_coverage(target_organization_id uuid)
 RETURNS TABLE(active_documents bigint, global_documents bigint, organization_documents bigint, indexed_documents bigint, documents_pending_index bigint, documents_without_chunks bigint, total_chunks bigint, chunks_without_embeddings bigint, audience_counts jsonb, latest_document_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  with docs as (
    select d.id, d.visibility, d.audience, d.updated_at
    from public.knowledge_documents d
    where d.status = 'active'
      and ((d.visibility = 'global' and d.audience in ('client_visible', 'consultant_only'))
        or (d.visibility = 'organization' and d.organization_id = target_organization_id and d.audience = 'client_visible'))
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
$function$
;
revoke all on function public.ai_knowledge_audit_coverage(uuid) from public, anon, authenticated;
grant execute on function public.ai_knowledge_audit_coverage(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.ai_knowledge_audit_document_evidence(target_organization_id uuid, target_document_ids uuid[])
 RETURNS TABLE(document_id uuid, title character varying, visibility character varying, audience character varying, version integer, checksum character varying, store_id uuid, chunk_index integer, content text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select d.id, d.title, d.visibility, d.audience, d.version, d.checksum,
    d.store_id, c.chunk_index, left(c.content, 700)
  from public.knowledge_documents d
  join lateral (
    select kc.chunk_index, kc.content from public.knowledge_chunks kc
    where kc.document_id = d.id order by kc.chunk_index limit 1
  ) c on true
  where cardinality(target_document_ids) <= 24
    and d.id = any(target_document_ids)
    and d.status = 'active'
      and ((d.visibility = 'global' and d.audience in ('client_visible', 'consultant_only'))
        or (d.visibility = 'organization' and d.organization_id = target_organization_id and d.audience = 'client_visible'))
  order by d.id;
$function$
;
revoke all on function public.ai_knowledge_audit_document_evidence(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.ai_knowledge_audit_document_evidence(uuid, uuid[]) to service_role;

CREATE OR REPLACE FUNCTION public.ai_knowledge_audit_semantic_candidates(target_organization_id uuid, source_document_limit integer DEFAULT 12, max_candidates integer DEFAULT 30)
 RETURNS TABLE(source_document_id uuid, source_title character varying, source_visibility character varying, source_audience character varying, source_updated_at timestamp with time zone, candidate_document_id uuid, candidate_title character varying, candidate_visibility character varying, candidate_audience character varying, candidate_updated_at timestamp with time zone, semantic_similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
  with scoped_documents as materialized (
    select d.id, d.title, d.visibility, d.audience, d.updated_at
    from public.knowledge_documents d
    where d.status = 'active'
      and ((d.visibility = 'global' and d.audience in ('client_visible', 'consultant_only'))
        or (d.visibility = 'organization' and d.organization_id = target_organization_id and d.audience = 'client_visible'))
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
$function$
;
revoke all on function public.ai_knowledge_audit_semantic_candidates(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_knowledge_audit_semantic_candidates(uuid, integer, integer) to service_role;


