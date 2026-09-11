-- AI-04: calidad de retrieval. Dos arreglos sobre knowledge_search_hybrid que
-- no cambian su contrato (misma firma, mismas columnas de salida) ni su
-- frontera de aislamiento (el WHERE se copia tal cual de la version anterior).
--
-- Se aplica con knowledge_chunks vacia a proposito: cambiar la configuracion
-- de busqueda de texto obliga a reconstruir el indice GIN, que sobre una tabla
-- vacia es instantaneo y sobre el corpus completo es un rebuild que hay que
-- vigilar.
--
-- ARREGLO 1 - el lexico estaba en 'simple', que no lematiza.
--   Con 'simple' cada palabra se indexa tal cual: "envios" no encajaba con
--   "envio" ni "devoluciones" con "devolucion". La pata lexica del hibrido era
--   coincidencia exacta de palabra, que sobre castellano (lleno de plurales y
--   de formas verbales) falla casi siempre. Pasa a 'spanish', que lematiza.
--
--   Medido en el proyecto de tests antes de escribir esto:
--     to_tsvector('spanish','Los envios salen manana') @@ plainto_tsquery('spanish','envio')  -> true
--     to_tsvector('simple', 'Los envios salen manana') @@ plainto_tsquery('simple','envio')   -> false
--
--   NO se añade `unaccent`, aunque "spanish + unaccent" sea el idiom habitual:
--   el stemmer español usa el acento para decidir. Medido:
--     spanish_stem('devolución')  -> 'devolu'
--     spanish_stem('devoluciones')-> 'devolu'      (encajan)
--     spanish_stem('devolucion')  -> 'devolucion'  (sin acento, otra rama)
--   Como `unaccent` corre ANTES del stemmer, quitar el acento convierte
--   'devolución' en 'devolucion' y deja de encajar con 'devoluciones': el
--   parche habria roto justo el caso que viene a arreglar. Una consulta
--   escrita sin acentos la recoge la pata semantica, que para eso esta -- los
--   embeddings son robustos a la ortografia y el lexico esta aqui para la
--   terminologia exacta.
--
-- ARREGLO 2 - la fusion sumaba puntuaciones de escalas distintas.
--   `0.70 * semantic + 0.25 * lexical + 0.05 * authority` parece un reparto
--   70/25/5, pero no lo es: la similitud coseno vive en 0..1 y ts_rank_cd
--   devuelve tipicamente centesimas, asi que el termino lexico aportaba una
--   fraccion de lo que su peso sugiere y el hibrido era, en la practica, casi
--   vector puro. Se pasa a fusion por rango reciproca (RRF), que combina las
--   POSICIONES de cada ranking y por eso no depende de la escala de ninguno.

-- 1. El indice de texto pasa a castellano.
--    Nota: la funcion indexa titulo || contenido, que cruza dos tablas y por
--    tanto no puede usar este indice de una sola tabla. Se mantiene alineado
--    con el contenido del fragmento porque es lo unico indexable aqui, y al
--    volumen de este corpus (miles de filas, no millones) el escaneo del
--    termino lexico no es el cuello de botella.
drop index if exists public.knowledge_chunks_content_fts_idx;
create index if not exists knowledge_chunks_content_fts_es_idx
  on public.knowledge_chunks
  using gin (to_tsvector('pg_catalog.spanish'::regconfig, content));

-- 2. La funcion: castellano en el lexico y fusion por rango.
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
          to_tsvector('pg_catalog.spanish'::regconfig, coalesce(d.title, '') || ' ' || c.content),
          plainto_tsquery('pg_catalog.spanish'::regconfig, coalesce(query_text, ''))
        ),
        1
      )::double precision as lexical_score,
      case d.authority
        when 'canonical' then 1::double precision
        when 'operational' then 0.65::double precision
        else 0.35::double precision
      end as authority_score
    -- Frontera de aislamiento: identica a la version anterior, palabra por
    -- palabra. Es lo unico que impide que un tenant lea el conocimiento
    -- privado de otro, porque la funcion se llama con service_role y no hay
    -- RLS detras que la respalde (ver el comentario de BE-01 en
    -- searchKnowledge).
    from public.knowledge_chunks c
    join public.knowledge_documents d on d.id = c.document_id
    where d.status = 'active'
      and c.embedding is not null
      and d.audience = any(audience_allowed)
      and (d.visibility = 'global' or c.organization_id = target_organization_id)
      and (target_store_id is null or d.store_id is null or d.store_id = target_store_id)
  ),
  ranked as (
    select
      scored.*,
      row_number() over (
        order by scored.semantic_similarity desc, scored.chunk_id
      ) as semantic_rank,
      -- Solo entran en el ranking lexico los que casan de verdad. Si los que
      -- no casan entraran con puntuacion 0, recibirian igualmente su
      -- 1/(k+rango) y un fragmento sin una sola palabra en comun con la
      -- pregunta subiria por el mero hecho de existir. El orden pone los que
      -- casan delante, asi que se quedan con los rangos 1..m y el resto se
      -- anula.
      case
        when scored.lexical_score > 0 then
          row_number() over (
            order by
              (scored.lexical_score > 0) desc,
              scored.lexical_score desc,
              scored.chunk_id
          )
        else null
      end as lexical_rank
    from scored
  )
  select
    ranked.chunk_id,
    ranked.document_id,
    ranked.document_title,
    ranked.visibility,
    ranked.audience,
    ranked.authority,
    ranked.chunk_index,
    ranked.content,
    -- RRF con k=60 (el valor convencional: amortigua el peso de los primeros
    -- puestos para que un unico ranking no domine la fusion).
    --
    -- La autoridad entra con un coeficiente deliberadamente pequeño. Dos
    -- puestos consecutivos de RRF se diferencian en ~0.00026, asi que
    -- 0.001 x (1 - 0.35) mueve un documento canonico dos o tres puestos
    -- frente a uno contextual igual de relevante: un desempate, no un
    -- criterio. Con el 0.05 de la version anterior la autoridad habria
    -- arrasado la fusion, porque la suma de RRF vive en ~0.03 y no en ~1.
    (
      1.0 / (60 + ranked.semantic_rank)
      + coalesce(1.0 / (60 + ranked.lexical_rank), 0)
      + 0.001 * ranked.authority_score
    )::double precision as similarity,
    ranked.semantic_similarity,
    ranked.lexical_score
  from ranked
  order by similarity desc, ranked.chunk_id
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.knowledge_search_hybrid is
  'Retrieval hibrido AI-04: vector + lexico en castellano (config spanish, con lematizacion), fusionados por rango reciproco (RRF, k=60) con la autoridad documental como desempate. Conserva los filtros de tenant, audiencia y tienda. OJO: la columna "similarity" es la puntuacion RRF (escala ~0.03), no una similitud 0..1 -- para mostrar un porcentaje a una persona hay que usar "semantic_similarity".';

grant execute on function public.knowledge_search_hybrid(uuid, extensions.vector, text, text[], uuid, integer) to service_role;
