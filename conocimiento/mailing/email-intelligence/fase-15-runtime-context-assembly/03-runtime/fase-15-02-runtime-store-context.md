# Fase 15.2 — Store Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Store Context representa la realidad relevante del ecommerce para una ejecución.

Puede incluir:
- mercado;
- modelo de negocio;
- objetivos;
- catálogo;
- pricing;
- shipping;
- returns;
- brand voice;
- visual system;
- margins;
- promotion policy;
- deliverability configuration.

Debe distinguir configuración estable de estado operativo cambiante.

El agente debe recibir solo la parte necesaria para la tarea.

---

## Entradas conceptuales

- `tenant_id`
- `task_type`
- `business_config`
- `brand_config`
- `commercial_config`
- `operational_config`
- `policy_refs`

---

## Salidas conceptuales

- `store_context_snapshot`
- `relevant_sections`
- `source_refs`
- `freshness`
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
