# DB-11 - RAG y Consultor IA

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

