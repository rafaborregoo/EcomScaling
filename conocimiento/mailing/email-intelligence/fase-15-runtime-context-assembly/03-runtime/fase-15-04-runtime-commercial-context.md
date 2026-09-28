# Fase 15.4 — Commercial Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Commercial Context agrupa las condiciones económicas y promocionales activas que pueden afectar una decisión.

Debe incluir según tarea:
- active offers;
- discount policy;
- margin constraints;
- promotion calendar;
- offer precedence;
- shipping incentives;
- product priorities;
- campaign priorities.

Debe distinguir:
```text
ACTIVE
SCHEDULED
EXPIRED
UNKNOWN
```

El contexto comercial debe poder cambiar sin modificar RAG.

---

## Entradas conceptuales

- `tenant_id`
- `timestamp`
- `market`
- `active_offers`
- `promotion_calendar`
- `margin_context`
- `offer_policy`
- `product_priorities`

---

## Salidas conceptuales

- `commercial_context_snapshot`
- `active_constraints`
- `available_offers`
- `economic_limits`
- `freshness`
- `version`

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
