-- AI-04: retrieval hibrido aditivo.
-- Mantiene public.knowledge_search intacta para compatibilidad y añade una
-- funcion que combina similitud vectorial con coincidencia lexical. El filtro
-- de tenant/audiencia/tienda es deliberadamente identico al contrato AI-07.

create index if not exists knowledge_chunks_content_fts_idx
on public.knowledge_chunks
using gin (to_tsvector('simple', content));

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
      )::double precision as lexical_score
    from public.knowledge_chunks c
    join public.knowledge_documents d on d.id = c.document_id
    where d.status = 'active'
      and c.embedding is not null
      and d.audience = any(audience_allowed)
      and (
        d.visibility = 'global'
        or c.organization_id = target_organization_id
      )
      and (
        target_store_id is null
        or d.store_id is null
        or d.store_id = target_store_id
      )
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
    (0.75 * scored.semantic_similarity + 0.25 * scored.lexical_score)::double precision as similarity,
    scored.semantic_similarity,
    scored.lexical_score
  from scored
  order by similarity desc, scored.chunk_id
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.knowledge_search_hybrid is 'Retrieval hibrido AI-04: combina vector + lexical y conserva los filtros obligatorios de tenant, audiencia y tienda de AI-07.';

grant execute on function public.knowledge_search_hybrid(uuid, extensions.vector, text, text[], uuid, integer) to service_role;
