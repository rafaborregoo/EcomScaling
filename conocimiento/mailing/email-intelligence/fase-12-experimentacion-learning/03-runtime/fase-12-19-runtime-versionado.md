# Fase 12.19 — Versionado — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para `Versionado`.

---

## Reglas específicas

- Usar IDs estables + version IDs.
- Mantener versiones inmutables.
- Resolver versión por effective_at.
- Conservar lineage completo.

---

## Invariantes

- misma definición + mismos datos = mismo cálculo;
- IDs y versiones deben ser estables;
- las asignaciones experimentales deben ser reproducibles;
- no utilizar información futura para decisiones históricas;
- el LLM no modifica resultados estadísticos oficiales;
- toda promoción, cambio o deprecación debe ser trazable.

---

## Auditoría mínima

```text
entity_id
entity_version
experiment_id
population
metric_definition
result
confidence
evidence_refs
status
created_at
```

---

## Principio maestro

El runtime ejecuta y calcula; no decide libremente qué evidencia “conviene”.
