# Fase 15.8 — Experience Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Experience Context selecciona aprendizajes relevantes de `05-experience-learning`.

Debe respetar jerarquía de alcance:
- tenant;
- category;
- global.

La selección debe considerar:
- scope fit;
- confidence;
- freshness;
- status;
- contradicting evidence.

Los aprendizajes `DEPRECATED` no deben entrar en contexto vigente.

La IA debe saber cuándo un aprendizaje es local y no generalizarlo.

---

## Entradas conceptuales

- `tenant_id`
- `category`
- `task_type`
- `learning_store`
- `current_context`
- `timestamp`

---

## Salidas conceptuales

- `selected_learnings`
- `scope`
- `confidence`
- `evidence_refs`
- `contradictions`
- `learning_versions`

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
