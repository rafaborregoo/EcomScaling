# DB-11 - RAG y Consultor IA

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
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
- **Gaps identificados que siguen abiertos:**
  - Sin estrategia de re-embedding documentada (cambiar de modelo de embeddings hoy rompe la tabla).
  - Sin localizacion precisa de cita (pagina/seccion/offset), solo documento + chunk.
  - Sin tamano/overlap/normalizacion de chunking documentado como parametro versionado.
  - Sin borrado en cascada / pipeline de tombstones documentado para conocimiento retirado.
  - Sin dataset de evaluacion de calidad (`recall@k`, precision de citas, respuestas sin evidencia) — los
    tests de prompt injection tampoco existen todavia (AI-06 pendiente).
  - Sin politica de retencion para `ai_conversations`/`ai_messages`.
- **Siguiente accion:** definir el dataset de evaluacion de calidad de retrieval (recall@k, precision de
  citas) como parte del resto de AI-06 -- el aislamiento cross-tenant ya no es parte de ese pendiente.

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
