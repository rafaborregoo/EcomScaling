# Fase 15.11 — Tool Routing

## Tipo de artefacto
`03-runtime`

## Objetivo

Tool Routing decide qué herramienta, motor o fuente debe usarse para obtener información o ejecutar una capacidad.

Debe diferenciar:
- retrieval;
- runtime engine;
- ecommerce API;
- ESP;
- analytics;
- catalog;
- experimentation;
- human approval.

El agente no debe responder con memoria generativa cuando existe una herramienta autoritativa necesaria.

El router puede devolver:
- direct answer allowed;
- tool required;
- multiple tools required;
- blocked;
- human required.

---

## Entradas conceptuales

- `task_type`
- `required_capabilities`
- `available_tools`
- `data_requirements`
- `policy_context`
- `autonomy_level`

---

## Salidas conceptuales

- `tool_plan`
- `selected_tools`
- `execution_order`
- `required_approvals`
- `fallbacks`
- `blocked_reasons`

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
