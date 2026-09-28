# Fase 15.14 — Output Validation

## Tipo de artefacto
`03-runtime`

## Objetivo

Output Validation comprueba una salida de IA antes de presentarla, aprobarla o ejecutarla.

Debe validar:
- schema/contract;
- required fields;
- unsupported claims;
- missing information;
- policy violations;
- stale references;
- invalid products/offers;
- contradictory states;
- confidence format;
- evidence presence;
- execution authorization.

Puede devolver:
- `VALID`;
- `VALID_WITH_WARNINGS`;
- `REPAIR_REQUIRED`;
- `BLOCKED`.

La validación debe separar errores reparables de bloqueos duros.

---

## Entradas conceptuales

- `agent_output`
- `contract_definition`
- `policy_context`
- `runtime_results`
- `source_map`
- `autonomy_context`
- `current_timestamp`

---

## Salidas conceptuales

- `validation_state`
- `errors`
- `warnings`
- `blocking_rules`
- `repair_instructions`
- `validated_output`
- `validation_version`

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
