# Fase 15.3 — Product Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Product Context ensambla hechos de producto necesarios para estrategia, copy, merchandising o recomendaciones.

Debe poder incluir:
- title;
- category;
- attributes;
- variants;
- price;
- stock;
- margin;
- product relationships;
- approved claims;
- assets;
- usage instructions.

Stock, precio y disponibilidad deben tratarse como datos volátiles.

No deben extraerse del RAG si existe una fuente operativa actual.

---

## Entradas conceptuales

- `product_ids`
- `task_type`
- `catalog_source`
- `inventory_source`
- `pricing_source`
- `margin_source`
- `approved_claims`
- `asset_source`

---

## Salidas conceptuales

- `product_context_snapshot`
- `availability_state`
- `commercial_state`
- `claim_refs`
- `asset_refs`
- `freshness`
- `source_refs`

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
