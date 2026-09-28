# Fase 15.9 — RAG Retrieval

## Tipo de artefacto
`03-runtime`

## Objetivo

RAG Retrieval selecciona conocimiento conceptual relevante desde `01-rag-produccion`.

El retrieval debe estar guiado por:
- task;
- phase/domain;
- query;
- current state;
- agent role.

Debe evitar:
- recuperar demasiados chunks;
- mezclar conocimiento irrelevante;
- usar tenant facts almacenados erróneamente en RAG;
- recuperar contenido deprecated si existe versionado.

RAG aporta conocimiento; no debe sobreescribir runtime source of truth.

---

## Entradas conceptuales

- `agent_role`
- `task_type`
- `query`
- `domain`
- `current_context`
- `rag_index`

---

## Salidas conceptuales

- `retrieved_chunks`
- `relevance_scores`
- `source_ids`
- `rag_versions`
- `coverage_gaps`

---

## Pipeline general

```text
REQUEST
→ RESOLVE REQUIRED DATA
→ FETCH AUTHORITATIVE SOURCES
→ CHECK FRESHNESS
→ NORMALIZE
→ APPLY POLICIES
→ ASSEMBLE / ROUTE / VALIDATE
→ VERSIONED OUTPUT
```

---

## Invariantes

- tenant isolation;
- source lineage;
- versionado;
- data minimization;
- no inventar campos ausentes;
- estados `UNKNOWN` explícitos;
- conflictos críticos visibles;
- mismas entradas + misma configuración = mismo resultado estructural;
- el LLM no redefine la autoridad de las fuentes.

---

## Observabilidad

El sistema debe poder responder:

```text
qué fuente se usó
por qué se eligió
qué versión tenía
qué tan fresca era
qué se omitió
qué conflicto apareció
qué policy se aplicó
```

---

## Principio maestro

El contexto no es un prompt gigante.

Es una construcción controlada, versionada y trazable de la información mínima necesaria para una tarea.
