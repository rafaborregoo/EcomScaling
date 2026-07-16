# BE-07 - Runtime IA, SQL Gateway y RAG

## Objetivo

Operar agentes auditables con contexto adaptativo, SQL de solo lectura y herramientas controladas.

## Entregables

- Orquestador de runs.
- SQL Gateway: SELECT/WITH, AST validation, tablas permitidas, timeout, limit y auditoria.
- Tools de negocio tipadas.
- RAG con ingestion, chunks, embeddings y citations.
- Approval service.
- Evals y datasets.

## Criterios de cierre

- Cero acceso a `private` o credenciales.
- El backend fuerza organizaciones autorizadas.
- Escrituras IA pasan por tools/RPCs y aprobaciones.

