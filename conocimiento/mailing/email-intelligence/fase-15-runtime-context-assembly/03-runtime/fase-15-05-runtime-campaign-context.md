# Fase 15.5 — Campaign Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Campaign Context representa la campaña concreta que un agente está diseñando, auditando o ejecutando.

Puede incluir:
- objective;
- campaign version;
- audience;
- exclusions;
- product focus;
- offer;
- creative state;
- schedule;
- measurement plan;
- conflict state;
- approval state.

Debe separar definición planificada y estado real de ejecución.

---

## Entradas conceptuales

- `campaign_id`
- `campaign_version`
- `task_type`
- `audience_snapshot`
- `creative_state`
- `schedule`
- `measurement_plan`
- `runtime_status`

---

## Salidas conceptuales

- `campaign_context_snapshot`
- `planned_state`
- `runtime_state`
- `conflicts`
- `missing_dependencies`
- `context_version`

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
