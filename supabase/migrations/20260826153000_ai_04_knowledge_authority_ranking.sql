-- AI-04: prioriza autoridad documental en el retrieval híbrido.
-- Migración posterior separada: no se modifica la migración original para que
-- instalaciones que ya la aplicaron reciban este cambio de forma incremental.

drop function if exists public.knowledge_search_hybrid(uuid, extensions.vector(1024), text, text[], uuid, integer);
create or replace function public.knowledge_search_hybrid(
  target_organization_id uuid,
  query_embedding extensions.vector(1024),
  query_text text,
  audience_allowed text[],
  target_store_id uuid default null,
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title varchar,
  visibility varchar,
  audience varchar,
  authority varchar,
  chunk_index integer,
  content text,
  similarity double precision,
  semantic_similarity double precision,
  lexical_score double precision
)
language sql
stable
set search_path = pg_catalog, public, extensions
as $$
  with scored as (
    select
      c.id as chunk_id,
      c.document_id,
      d.title as document_title,
      d.visibility,
      d.audience,
      d.authority,
      c.chunk_index,
      c.content,
      greatest(1 - (c.embedding <=> query_embedding), 0)::double precision as semantic_similarity,
      least(
        ts_rank_cd(
          to_tsvector('simple', coalesce(d.title, '') || ' ' || c.content),
          plainto_tsquery('simple', coalesce(query_text, ''))
        ),
        1
      )::double precision as lexical_score,
      case d.authority
        when 'canonical' then 1::double precision
        when 'operational' then 0.65::double precision
        else 0.35::double precision
      end as authority_score
    from public.knowledge_chunks c
    join public.knowledge_documents d on d.id = c.document_id
    where d.status = 'active'
      and c.embedding is not null
      and d.audience = any(audience_allowed)
      and (d.visibility = 'global' or c.organization_id = target_organization_id)
      and (target_store_id is null or d.store_id is null or d.store_id = target_store_id)
  )
  select
    scored.chunk_id,
    scored.document_id,
    scored.document_title,
    scored.visibility,
    scored.audience,
    scored.authority,
    scored.chunk_index,
    scored.content,
    (0.70 * scored.semantic_similarity + 0.25 * scored.lexical_score + 0.05 * scored.authority_score)::double precision as similarity,
    scored.semantic_similarity,
    scored.lexical_score
  from scored
  order by similarity desc, scored.chunk_id
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.knowledge_search_hybrid is 'Retrieval híbrido AI-04: vector + lexical + autoridad documental, conservando filtros de tenant, audiencia y tienda.';
comment on column public.knowledge_documents.authority is 'Peso de confianza usado por knowledge_search_hybrid: canonical > operational > contextual.';

-- La función semántica anterior también queda protegida contra resolución
-- mutable de nombres cuando esta migración incremental se aplique.
alter function public.knowledge_search(
  uuid,
  extensions.vector,
  text[],
  uuid,
  integer
) set search_path = pg_catalog, public, extensions;
