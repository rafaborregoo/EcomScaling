# Fase 18.9 — Merchandising — Runtime

## Tipo de artefacto
`03-runtime`

## Objetivo

Automatizar las comprobaciones objetivas de `Merchandising`.

## Comprobaciones

- Comparar recomendaciones con stock y compatibilidad.
- Analizar diversidad y repetición.
- Detectar productos no disponibles promocionados.
- Relacionar selección con affinity/intent cuando exista.

## Pipeline

```text
COLLECT
→ NORMALIZE
→ CHECK FRESHNESS
→ RUN DETERMINISTIC CHECKS
→ ATTACH EVIDENCE
→ EMIT FINDINGS
```

## Reglas

- no emitir PASS si falta un dato crítico;
- conservar source y version;
- no usar el LLM para recalcular métricas oficiales;
- no mezclar tenants;
- separar `observed` de `inferred`.

## Salida conceptual

```text
check_id
status
observed_value
expected_condition
evidence_refs
reason_code
data_quality
rules_version
checked_at
```

## Principio maestro

El runtime aporta hechos comprobables; el Audit Agent aporta interpretación y plan de acción.
