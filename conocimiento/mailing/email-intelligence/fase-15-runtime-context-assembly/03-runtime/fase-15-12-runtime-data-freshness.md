# Fase 15.12 — Data Freshness

## Tipo de artefacto
`03-runtime`

## Objetivo

Data Freshness determina si un dato sigue siendo suficientemente actual para una tarea.

La frescura debe depender del tipo de dato.

Ejemplos:
- stock: muy volátil;
- price: volátil;
- campaign schedule: sensible;
- brand voice: más estable;
- legal/provider policy: versionada por vigencia;
- product description: relativamente estable.

No debe existir un TTL universal para todos los campos.

El sistema debe poder devolver:
```text
FRESH
STALE
EXPIRED
UNKNOWN
```

La decisión sobre datos stale depende del riesgo de la acción.

---

## Entradas conceptuales

- `data_item`
- `source_timestamp`
- `current_timestamp`
- `data_type`
- `task_type`
- `freshness_policy`

---

## Salidas conceptuales

- `freshness_state`
- `age`
- `allowed_usage`
- `refresh_required`
- `reason_code`

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
