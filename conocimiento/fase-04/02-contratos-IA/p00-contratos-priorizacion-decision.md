# Fase 04 · P00 — Contratos de priorización y decisión

## Estado

A diferencia de otros bloques previos, P00 sí define explícitamente objetos, enums e invariantes contractuales.

Este documento conserva esos contratos conceptuales sin añadir campos no presentes en la fuente.

---

## 1. Phase Boundary Contract

Flujo canónico:

`F3 OUTPUT: DIAGNOSTIC_RESULT[]`
→ `F4 PRIORITIZATION_ENGINE`
→ `DECISION_RESULT`
→ `F5 STRATEGY / PLAYBOOK ENGINE`

Hard invariant:

`F4 MUST NOT GENERATE IMPLEMENTATION PLAYBOOKS`

---

## 2. PRIORITIZATION_REQUEST

Objeto raíz conceptual:

```text
PRIORITIZATION_REQUEST {
    request_id,
    tenant_id,
    generated_at,
    as_of,
    decision_horizon,

    diagnostic_snapshot_id,
    diagnostic_candidates[],

    business_context_ref,
    maturity_snapshot_ref,
    objective_context_ref,

    available_evidence_refs[],

    engine_version,
    schema_version
}
```

---

## 3. diagnostic_candidates[]

Contrato mínimo:

```text
diagnostic_candidates[] {
    diagnostic_id,
    case_id,
    capability_id,

    diagnostic_type,
    status,

    root_cause_ref,
    constraint_ref,

    severity,
    diagnostic_confidence,
    trajectory,

    impact_ref,
    temporal_ref,
    evidence_refs[],

    parent_diagnostic_id?,
    related_diagnostic_ids[]
}
```

P2 será responsable de normalización avanzada.

---

## 4. DECISION_CANDIDATE_TYPE

Canonical enum:

```text
PROBLEM
CONSTRAINT
RISK
OPPORTUNITY
VALIDATION_NEED
```

No todo diagnóstico debe convertirse en candidato.

---

## 5. DECISION_CONTEXT

Objeto obligatorio:

```text
DECISION_CONTEXT {
    as_of,
    horizon,

    business_objectives[],
    protected_outcomes[],

    current_constraints[],
    resource_context,
    risk_context,

    maturity_context,
    known_commitments[],
    hard_guardrails[]
}
```

Su construcción detallada pertenece a P1.

---

## 6. DECISION_HORIZON

Canonical enum:

```text
IMMEDIATE
DAYS
WEEKS
MONTH
QUARTER
LONG_TERM
```

Posteriormente pueden existir ventanas temporales exactas además del enum.

---

## 7. DECISION_RESULT

Objeto raíz:

```text
DECISION_RESULT {
    decision_result_id,
    request_id,
    tenant_id,

    as_of,
    horizon,

    decision_queue[],

    deferred_candidates[],
    validation_candidates[],
    blocked_candidates[],
    monitoring_candidates[],
    excluded_candidates[],

    portfolio_summary,

    decision_confidence,

    trace,

    engine_version,
    rule_version,
    schema_version,

    created_at
}
```

---

## 8. DECISION_ITEM

Objeto canónico:

```text
DECISION_ITEM {
    rank,
    candidate_id,
    diagnostic_id,

    decision_class,
    priority_tier,

    why_now[],
    why_before[],

    primary_drivers[],
    counterarguments[],

    dependencies[],
    blockers[],

    value_at_risk,
    value_to_unlock,

    time_sensitivity,
    decision_risk,
    reversibility_context,

    diagnostic_confidence,
    decision_confidence,

    uncertainty[],

    what_would_change_priority[],

    evidence_refs[],

    trace_ref
}
```

Cuando un campo no puede evaluarse:

- `UNKNOWN`
- `NOT_ASSESSABLE`

son preferibles a precisión inventada.

---

## 9. DECISION_CLASS

Canonical enum:

```text
REQUIRES_IMMEDIATE_ATTENTION
PRIORITIZE
VALIDATE_FIRST
SCHEDULE
MONITOR
DEFER
BLOCKED
EXCLUDE
```

Describe tratamiento decisional, no playbook.

---

## 10. PRIORITY_TIER

Canonical enum:

```text
P0_EMERGENCY
P1_CRITICAL
P2_HIGH
P3_MEDIUM
P4_LOW
```

`priority_tier` y `rank` son conceptos distintos.

---

## 11. DECISION_CONFIDENCE

Canonical enum inicial:

```text
VERY_LOW
LOW
MEDIUM
HIGH
VERY_HIGH
NOT_ASSESSABLE
```

Hard invariant:

`DIAGNOSTIC_CONFIDENCE ≠ DECISION_CONFIDENCE`

---

## 12. Exclusion Reasons

Canonical enum inicial:

```text
DUPLICATE
DOWNSTREAM_SYMPTOM
RESOLVED
NON_MATERIAL
OUT_OF_SCOPE
INSUFFICIENT_EVIDENCE
INVALID_INPUT
SUPERSEDED
```

`INSUFFICIENT_EVIDENCE` puede transformarse en `VALIDATION_NEED`.

---

## 13. Blocked Candidate

Debe poder conservar:

- `blocked_by[]`
- `blocking_reason`

`BLOCKED ≠ LOW_IMPORTANCE`

---

## 14. PRIORITIZATION_STATUS

Canonical status:

```text
SUCCESS
PARTIAL
NOT_ASSESSABLE
INVALID_INPUT
CONTEXT_INSUFFICIENT
CONFLICTING_EVIDENCE
ENGINE_ERROR
```

El motor no debe fabricar ranking para ocultar `CONTEXT_INSUFFICIENT`.

---

## 15. DECISION_TRACE

Conceptualmente:

```text
DECISION_TRACE {
    trace_id,
    request_id,

    candidate_ids[],
    evidence_refs[],

    objective_context,
    active_constraints[],
    active_guardrails[],

    factors_considered[],
    rules_triggered[],
    overrides_applied[],

    ranking_changes[],

    excluded_candidates[],
    uncertainty_flags[],

    model_version?,
    prompt_version?,
    engine_version,
    rule_version,

    created_at
}
```

---

## 16. PRIORITY_CHANGED

Cuando la posición cambie materialmente debe poder registrarse un evento:

```text
PRIORITY_CHANGED
```

Debe poder conservar:

- previous state/rank;
- current state/rank;
- reason.

---

## 17. Priority Equivalence

El contrato debe admitir:

- `TIED`
- o rangos/equivalencia decisional

cuando la evidencia no permita ordenar materialmente A y B.

La fuente no define la representación técnica final.

---

## 18. Priority Invalidators

Todo `DECISION_ITEM` material debe poder conservar:

- `what_would_change_priority[]`

Esto hace la decisión falsable y actualizable.

---

## 19. Mandatory Traceability

No puede existir `DECISION_ITEM` sin referencias hacia:

- diagnostic;
- evidence;
- decision context;
- rules applied;
- engine version.

---

## 20. Phase Boundary

El output F4 no debe contener:

- implementation_steps;
- playbook;
- campaign_plan;
- code_changes;
- creative_brief;
- exact_remediation;
- execution_sequence;

salvo referencias estructurales necesarias para dependencias decisionales.

---

## 21. Contract Boundaries

P00 define el contrato mínimo.

No define todavía:

- fórmula final de ranking;
- normalización avanzada de factores;
- deduplicación avanzada;
- scoring implementation;
- portfolio optimizer;
- playbook selection.
