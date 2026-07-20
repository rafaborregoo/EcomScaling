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
- **Gaps identificados:**
  - Sin estrategia de re-embedding documentada (cambiar de modelo de embeddings hoy rompe la tabla).
  - Sin localizacion precisa de cita (pagina/seccion/offset), solo documento + chunk.
  - Sin tamano/overlap/normalizacion de chunking documentado como parametro versionado.
  - Sin borrado en cascada / pipeline de tombstones documentado para conocimiento retirado.
  - Sin dataset de evaluacion (`recall@k`, precision de citas, respuestas sin evidencia, contaminacion
    cross-tenant) — los tests de prompt injection tampoco existen todavia (AI-06 pendiente).
  - Sin politica de retencion para `ai_conversations`/`ai_messages`.
- **Siguiente accion:** definir el dataset de evaluacion de retrieval (recall@k + contaminacion
  cross-tenant) como parte del resto de AI-06.

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

