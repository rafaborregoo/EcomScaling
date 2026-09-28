# Fase 12.11 — Guardrail Metrics — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Definir la lógica determinista necesaria para `Guardrail Metrics`.

---

## Reglas específicas

- Evaluar guardrails junto a primary metric.
- Aplicar thresholds configurados.
- Marcar experiment_result como blocked cuando corresponde.
- Registrar qué guardrail falló.

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
