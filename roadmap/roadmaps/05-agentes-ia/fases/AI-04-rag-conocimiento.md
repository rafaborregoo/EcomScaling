# AI-04 - RAG y conocimiento

## Estado

- **Estado real:** `implementation_complete_live_validation_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-11
- **Bloqueador:** falta `VOYAGE_API_KEY` para validar retrieval en vivo (sin ella `search_knowledge` no se
  habilita, ver AI-00/AI-02).
- **Evidencia:** ingestion con chunking por parrafos y embeddings por lotes (Voyage `voyage-3.5`, interfaz
  `EmbeddingProvider` swappable), clasificacion global/organizacion con constraint en DB, retrieval con
  citas via `knowledge_search`, endpoints `/knowledge/documents` y `/knowledge/search`.
- **Gaps reales que van mas alla de "falta la API key" (no implementados, no solo pendientes de probar):**
  - Chunking por parrafos puede romper tablas, listas, encabezados y procedimientos — falta chunking
    estructural (document -> section -> subsection -> paragraph/table/list) que conserve seccion/pagina/
    tipo/vigencia por chunk.
  - Solo hay busqueda vectorial; falta hibrida (embeddings + full-text + filtros de metadata + rerank) —
    relevante para terminos exactos como "ROAS break-even" que la similitud semantica sola puede no
    priorizar bien.
  - Sin autoridad de fuentes (`approved_playbook` > `client_document` > `draft`/`deprecated`) — todo
    documento pesa igual en el retrieval.
  - Sin resolucion de contradicciones (que version esta vigente, que documento sustituye a cual, fecha
    efectiva, actor que aprobo).
  - El contenido recuperado no esta explicitamente tratado como no confiable en el prompt del agente
    (riesgo de inyeccion via documento subido) — pendiente de verificar/anadir la instruccion explicita.
- **Siguiente accion:** conseguir `VOYAGE_API_KEY` de un entorno de prueba y correr retrieval real antes de
  invertir en chunking estructural o busqueda hibrida — sin datos reales de recall no se sabe si esos son
  los problemas que mas importan.

## Objetivo

Permitir que el Consultor IA use metodologia EcomScaling versionada y citada.

## Entregables

- Ingestion de documentos.
- Clasificacion global/organizacion.
- Chunking y embeddings.
- Retrieval con citas.
- Gestion de versiones y conflictos.

## Criterios de cierre

- Respuestas citan documentos.
- Casos privados no pasan a conocimiento global sin aprobacion.
- Tests de retrieval y prompt injection.

