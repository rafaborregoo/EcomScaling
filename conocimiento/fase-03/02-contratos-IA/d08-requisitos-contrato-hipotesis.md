# Fase 03 · D08 — Requisitos contractuales del motor de hipótesis

## Estado

La fuente define un contrato conceptual muy detallado para hipótesis, evidencia, tests, confidence, ledger y comparación, pero no un schema técnico final.

---

## 1. Hypothesis Object

Debería poder representar:

- hypothesis_code;
- case_specific_statement;
- hypothesis_type;
- family;
- target;
- scope;
- valid_from;
- valid_to;
- status;
- confidence;
- prior_plausibility;
- explanatory_power;
- explanatory_coverage;
- residual;
- root_cause_candidate;
- acute_or_structural;
- immediate_or_underlying;
- limitations;
- assumptions.

---

## 2. Hypothesis Types

- DIRECT_CAUSE
- CONTRIBUTORY_CAUSE
- ROOT_CAUSE_CANDIDATE
- CONTEXTUAL_EXPLANATION
- DATA_QUALITY_EXPLANATION
- STRUCTURAL_EXPLANATION
- EXTERNAL_EXPLANATION
- INTERACTION_HYPOTHESIS

---

## 3. Hypothesis Status

Debe poder representar estados como:

- UNTESTED
- UNDER_TEST
- SUPPORTED
- WEAKLY_SUPPORTED
- PARTIALLY_SUPPORTED
- MOST_LIKELY
- CONTRADICTED
- INVALIDATED
- CONFIRMED
- INCONCLUSIVE

La fuente no define una state machine técnica definitiva.

---

## 4. Evidence Ledger

Por hypothesis debe poder mantenerse:

- supporting_evidence[];
- contradicting_evidence[];
- missing_evidence[];
- discriminating_evidence[];
- evidence_conflicts[];
- assumptions[];
- tests[];
- status_history[].

---

## 5. Evidence Item

Un evidence item puede requerir:

- source;
- timestamp/window;
- reliability;
- independence;
- directness;
- specificity;
- temporal fit;
- scope fit;
- freshness;
- contradiction strength;
- lineage/reference.

---

## 6. Missing Evidence

Debe poder distinguirse missing evidence crítica de evidence observed absent.

---

## 7. Diagnostic Test

Un test debería poder representar:

- hypothesis;
- diagnostic question;
- required data;
- expected_if_true;
- expected_if_false;
- information gain;
- cost;
- latency;
- availability;
- intrusiveness;
- passive_or_active;
- result;
- interpretation.

---

## 8. Next Best Test

Debe poder existir:

- `NEXT_BEST_TEST`

como acción diagnóstica.

No debe confundirse con business action.

---

## 9. Hypothesis Comparison

Debe poder comparar hipótesis por:

- mechanism fit;
- temporal fit;
- scope fit;
- magnitude fit;
- context fit;
- maturity fit;
- health fit;
- signal fit;
- evidence support;
- contradictions;
- missing evidence;
- separation.

---

## 10. Relative Roles

Puede asignarse:

- PRIMARY_HYPOTHESIS
- SECONDARY_HYPOTHESIS
- ALTERNATIVE_HYPOTHESIS
- CHALLENGER_HYPOTHESIS

---

## 11. Confidence

Categorías:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT

No se define fórmula exacta.

---

## 12. Hypothesis Separation

Puede representarse conceptualmente:

- high separation;
- low separation.

Low separation limita confidence.

---

## 13. Explanatory Coverage

Debe poder separarse:

- confidence;
- explanatory coverage.

---

## 14. Unexplained Residual

Debe poder conservarse:

- unexplained_residual;
- materiality.

---

## 15. Partial Cause

Debe poder representarse:

- PARTIAL_CAUSE
- estimated contribution cuando sea posible;
- assumptions.

---

## 16. Multicausal Explanation

Debe soportar múltiples hypotheses contributory simultáneas.

---

## 17. Hypothesis Chain

Una hypothesis multi-step debería poder representar:

- ordered steps;
- edge-level support;
- weakest link;
- overall confidence.

---

## 18. Root Cause Candidate

Debe poder marcarse:

- root_cause_candidate = true

sin convertirlo todavía en root cause validada.

---

## 19. Acute / Structural

Debe poder distinguir:

- ACUTE_CAUSE
- STRUCTURAL_DRIVER

y también immediate cause vs underlying driver.

---

## 20. Diagnostic Uncertainty

Debe poder representar:

- DATA_UNCERTAINTY
- MODEL_UNCERTAINTY
- CONTEXT_UNCERTAINTY
- CAUSAL_UNCERTAINTY

---

## 21. Historical Ledger

Debe poder conservarse:

- generated_at;
- status transitions;
- evidence additions;
- invalidation reason;
- confirmation reason;
- expiry;
- recurrence.

---

## 22. Multi-agent Source

Puede asociarse:

- proposing agent;
- validating agent;
- orchestrator decision;
- agent-specific calibration metadata.

---

## 23. Versioning / Scope Evolution

La source implica que una hypothesis puede:

- narrow scope;
- split;
- merge;
- change validity window.

La implementación técnica queda abierta.

---

## 24. Explainability Output

Debe poder responder:

- why this hypothesis;
- why not alternatives;
- missing evidence;
- falsification condition;
- limitations.

---

## 25. Boundaries

D8 no debe producir como hecho final:

- root cause validada;
- constraint final;
- business action;
- priority.

---

## 26. Elementos no definidos

No están definidos:

- JSON Schema;
- DB schema;
- score formula;
- confidence formula;
- exact candidate cap;
- exact weighting;
- orchestration protocol;
- APIs;
- persistence model.
