# DB-11 - RAG y Consultor IA

> **Auditoría de implementación 2026-08-26:** el estado `verification_pending` no significa que el
> núcleo RAG siga sin implementar. `chunkText` aplica chunking estructural con solape y encabezados,
> la ingesta procesa embeddings en batches con concurrencia acotada y orden determinista, y la API
> usa búsqueda híbrida con fallback compatible. La migración de ranking por autoridad
> (`20260826153000_ai_04_knowledge_authority_ranking.sql`) ya está aplicada y alineada en remoto junto
> con las 75 migraciones locales. Lo que sigue abierto es
> la validación de recall/precisión sobre corpus real y el versionado persistente de la estrategia de
> chunking/re-embedding; no se deben confundir esos gaps con ausencia de infraestructura.

> **Perfil versionado 2026-08-26:** `packages/ai/src/index.ts` expone `RAG_EMBEDDING_PROFILE`
> (`structural-v1`, `voyage-3.5`, 1024 dimensiones, 1500 caracteres y 200 de solape). El proveedor
> mantiene el modelo swappable para tests y futuras migraciones, pero los defaults de producción ya
> no están duplicados entre el proveedor y el chunker.

## Estado

> Corrección vigente 2026-08-26: las migraciones aditivas
> `20260801100000_ai_04_knowledge_hybrid_search.sql` ya forma parte de las
> 75 migraciones locales/remotas alineadas. La API mantiene fallback al RPC
> anterior por compatibilidad; queda pendiente ampliar el dataset, no aplicar
> la migracion.

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-26
- **Dependencias:** DB-00, DB-02, DB-08
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion `db_11_rag_conocimiento` aplicada en remoto: extension pgvector, `knowledge_documents`
    (checksum, versionado, visibilidad global/organization con constraint de coherencia),
    `knowledge_chunks` con `vector(1024)` (Voyage `voyage-3.5`, proveedor swappable, ADR-0006) e indice
    HNSW, `ai_conversations`/`ai_messages`, funcion `knowledge_search` (global + privado del tenant, nunca
    privado de otros).
  - La dimension `1024` es consistente entre migracion real y esta documentacion — el
    `schema_conceptual_snapshot.sql` retirado declaraba `vector(1536)` incorrectamente; esa incoherencia
    estaba en el snapshot, no aqui.
  - Validado en vivo con un catalogo vacio (A08, gestor de conocimiento): razono correctamente sobre un
    posible fallo de sync/enlace en vez de alucinar vacios inexistentes.
- **Test de aislamiento cross-tenant anadido y confirmado 2026-07-21**: `apps/api/src/db-11-knowledge-search-isolation.test.ts`
  crea un documento privado (`visibility='organization'`) con un chunk de embedding sintetico determinista, y
  confirma contra el Supabase remoto real que `knowledge_search` (funcion SQL sin `security definer`, confia
  en el `target_organization_id` que le pasa el backend) nunca lo devuelve para otra organizacion, y si lo
  devuelve para la suya. Cubre el caso mas grave de "contaminacion cross-tenant" del gap de abajo (fuga de
  conocimiento privado entre clientes); no cubre recall@k ni precision de citas, que necesitan un dataset
  real, no solo un caso sintetico de aislamiento.
- **Cerrado 2026-07-23 (correccion 2026-07-27: esta seccion no se habia actualizado cuando cerro, deriva
  documental real, ver R-022)**: dataset de `recall@k` corrido contra Voyage real
  (`apps/api/src/eval-ai04-rag-retrieval.ts`, `npm run eval:ai04 -w @e-nora/api`) -- 6 documentos de
  metodologia con consultas parafraseadas (nunca coincidencia lexica exacta), recall@8 y recall@3 ambos
  6/6 (100%). Cubre el caso principal del gap; no cubre corpus grande/estructurado ni terminologia exacta
  (busqueda hibrida).
- **Cerrado 2026-07-27**: politica de retencion de `ai_conversations`/`ai_messages` decidida con el mismo
  criterio que ADR-0016 (transcripciones) y AI-00 (contexto enviado al LLM) -- sin limite de tiempo ni
  redaccion mientras no haya cliente real en el Piloto 1, purga junto con el resto de datos de la
  organizacion via `purgeExpiredDeletions` (`ai_conversations.organization_id references organizations on
delete cascade`, `ai_messages` en cascada de `ai_conversations`). Reevaluar en los mismos disparadores que
  ADR-0016.
- **Gaps identificados que siguen abiertos:**
  - Sin estrategia de re-embedding documentada (cambiar de modelo de embeddings hoy rompe la tabla).
  - Sin localizacion precisa de cita (pagina/seccion/offset), solo documento + chunk.
  - Sin tamano/overlap/normalizacion de chunking documentado como parametro versionado.
  - Sin borrado en cascada / pipeline de tombstones documentado para conocimiento **retirado en vida**
    (`status='archived'` sin borrar) -- el borrado por baja de organizacion si esta cubierto (ver arriba).
  - Sin dataset de precision de citas ni de respuestas sin evidencia (recall@k si esta cerrado, ver
    arriba); tests de prompt injection documental ya existen para BE-07, no repetidos aqui todavia.
- **Siguiente accion:** chunking por tamano/overlap versionado y busqueda hibrida son las dos mejoras que
  mas moverian precision — ninguna es urgente sin corpus real de cliente todavia.

## Objetivo

Activar conocimiento, conversaciones y recuperacion semantica para el Consultor IA avanzado.

## Tablas

- `knowledge_documents`
- `knowledge_chunks`
- `ai_conversations`
- `ai_messages`
- tablas runtime IA ya creadas o ampliadas.

## Entregables

- Extension/vector index si se usa pgvector.
- Visibilidad global vs por organizacion.
- Checksums, versionado y lineage de documentos.
- Politica de retencion de conversaciones y runs.

## Criterios de cierre

- RAG cita fuentes.
- No mezcla conocimiento privado de una organizacion con conocimiento global.
- Tests de retrieval, permisos y prompt injection.

## Corrección 2026-08-01 — función híbrida aditiva

Se preparó `20260801100000_ai_04_knowledge_hybrid_search.sql`. Añade un índice GIN para texto y el RPC
`knowledge_search_hybrid`, manteniendo la función `knowledge_search` existente para compatibilidad durante
el rollout. La API detecta la ausencia temporal del nuevo RPC y usa el anterior; ambos aplican aislamiento
por organización, audiencia y tienda. La migración ya está aplicada y alineada; queda ampliar el eval con
documentos largos/estructurados y consultas de terminología exacta.
La frontera de API y su fallback tienen 3 pruebas aisladas; queda pendiente la validación contra el RPC
híbrido en el entorno de despliegue.
