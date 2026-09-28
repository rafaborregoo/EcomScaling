# Fase 15.13 — Source of Truth

## Tipo de artefacto
`03-runtime`

## Objetivo

Source of Truth define qué sistema tiene autoridad para cada clase de dato.

Ejemplos:
- stock → inventory/ecommerce;
- order → ecommerce/order system;
- margin → financial/business configuration;
- consent → consent/ESP/CRM authoritative store;
- brand voice → approved tenant context;
- conceptual marketing knowledge → RAG;
- learning → experience store;
- policy → policy registry.

Debe existir un mapa explícito de precedencia.

Si dos fuentes autoritativas discrepan, el sistema debe declarar conflicto en lugar de inventar reconciliación.

---

## Entradas conceptuales

- `data_domain`
- `candidate_sources`
- `source_registry`
- `timestamp`
- `tenant_id`

---

## Salidas conceptuales

- `authoritative_source`
- `fallback_sources`
- `conflicts`
- `authority_reason`
- `source_version`

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
