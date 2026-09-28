# Fase 15.6 — Flow Context

## Tipo de artefacto
`03-runtime`

## Objetivo

Flow Context describe el flow, su versión y la instancia/oportunidad concreta.

Debe distinguir:
- flow definition;
- flow instance;
- current step;
- eligibility;
- previous messages;
- exits;
- re-entry;
- conflicts;
- delays;
- current opportunity.

Un agente que genera un email de flow debe conocer el papel exacto del mensaje dentro de la secuencia.

---

## Entradas conceptuales

- `flow_id`
- `flow_version`
- `flow_instance_id`
- `current_step`
- `eligibility_result`
- `customer_state`
- `message_history`
- `arbitration_result`

---

## Salidas conceptuales

- `flow_context_snapshot`
- `step_role`
- `instance_state`
- `valid_next_actions`
- `conflicts`
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
