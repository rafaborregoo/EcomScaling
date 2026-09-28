# Fase 15.10 — Context Assembly

## Tipo de artefacto
`03-runtime`

## Objetivo

Context Assembly combina todos los contextos necesarios para una ejecución de agente.

Orden conceptual:

```text
REQUEST
→ CUSTOMER
→ STORE
→ PRODUCT
→ COMMERCIAL
→ CAMPAIGN / FLOW
→ POLICY
→ EXPERIENCE
→ RAG
→ FINAL CONTEXT
```

Debe aplicar:
- relevance filtering;
- token budgeting;
- source prioritization;
- deduplication;
- conflict detection;
- freshness.

El contexto final debe poder explicar de dónde salió cada parte.

No debe resolverse un conflicto entre fuentes simplemente eligiendo el texto más reciente sin conocer autoridad.

---

## Entradas conceptuales

- `request`
- `customer_context`
- `store_context`
- `product_context`
- `commercial_context`
- `campaign_context`
- `flow_context`
- `policy_context`
- `experience_context`
- `rag_context`

---

## Salidas conceptuales

- `assembled_context`
- `context_sections`
- `source_map`
- `conflicts`
- `missing_information`
- `token_budget_usage`
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
