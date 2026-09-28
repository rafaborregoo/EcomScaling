# Fase 15.1 — Customer Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Customer Context construye una vista operativa compacta y actual del cliente para una tarea concreta.

Debe ensamblar únicamente información relevante:
- identidad resoluble;
- lifecycle;
- intent;
- engagement;
- RFM;
- affinity;
- purchase history;
- promotion history;
- current operational states;
- consent/suppression;
- recent communications.

No debe entregar al agente todo el histórico bruto si no es necesario.

La construcción debe ser task-aware: el contexto para un flow de cart no necesita exactamente los mismos datos que un análisis de churn.

---

## Entradas conceptuales

- `customer_id`
- `task_type`
- `lifecycle_result`
- `intent_result`
- `engagement_result`
- `rfm_result`
- `affinity_result`
- `order_history`
- `communication_history`
- `consent_state`
- `suppression_state`

---

## Salidas conceptuales

- `customer_context_snapshot`
- `included_fields`
- `omitted_fields`
- `freshness`
- `source_refs`
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
