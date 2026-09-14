# Fase 03 · D09 — Requisitos contractuales de Root Cause & Constraint

## Estado

La fuente define entidades y relaciones conceptuales muy claras, pero no implementa un schema técnico definitivo.

---

## 1. Root Cause Object

Debería poder representar:

- cause_code;
- statement;
- family;
- type;
- scope;
- status;
- confidence;
- evidence;
- causal_path;
- immediate_cause;
- intermediate_causes;
- underlying_driver;
- primary/secondary/contributing role;
- coverage;
- residual;
- controllability;
- reversibility;
- recurrence;
- active/resolved;
- downstream_capabilities;
- assumptions;
- limitations.

---

## 2. Root Cause Status

Debe poder expresar conceptualmente:

- PROBABLE
- CONFIRMED
- PARTIAL_ROOT_CAUSE
- UNRESOLVED
- ACTIVE
- RESOLVED
- RECURRENT

La fuente no define una state machine final.

---

## 3. Root Cause Role

Puede existir:

- PRIMARY_ROOT_CAUSE
- SECONDARY_ROOT_CAUSE
- CONTRIBUTING_CAUSE

---

## 4. Root Cause Type

Debe poder representar:

- ACUTE
- CHRONIC
- STRUCTURAL
- EVENT_DRIVEN
- PROCESS
- CAPACITY
- CONFIGURATION
- QUALITY
- PLANNING
- DEPENDENCY
- EXTERNAL
- POSITIVE_DRIVER

---

## 5. Root Cause Family

Puede pertenecer a:

- MARKET
- PRODUCT
- OFFER
- ECONOMICS
- ACQUISITION
- CREATIVE
- CONVERSION
- RETENTION
- INVENTORY
- OPERATIONS
- FINANCE
- DATA
- TECHNOLOGY
- TEAM
- STRATEGY
- EXTERNAL

---

## 6. Root Cause Chain

Debe poder representar roles:

- STRUCTURAL_DRIVER
- ROOT_CAUSE
- IMMEDIATE_CAUSE
- INTERMEDIATE_CAUSE
- SYMPTOM
- OUTCOME

---

## 7. Evidence

Debe poder conservar:

- direct system evidence;
- intervention evidence;
- control comparison;
- multi-source corroboration;
- temporal/mechanistic evidence;
- pattern match;
- heuristic evidence;
- contradictions;
- missing evidence.

---

## 8. Confidence

Categorías:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT

No se define fórmula exacta.

---

## 9. Coverage / Residual

Debe separarse:

- causal confidence;
- explanatory coverage;
- unexplained residual.

---

## 10. Constraint Object

Debería poder representar:

- constraint_code;
- statement;
- type;
- scope;
- target;
- binding_status;
- confidence;
- evidence;
- capacity;
- demand_on_capacity;
- hard_or_soft;
- acute_or_structural;
- primary/secondary/latent;
- blast_radius;
- exposure;
- counterfactual;
- falsifier;
- active/resolved.

---

## 11. Constraint Types

- DEMAND_CONSTRAINT
- PRODUCT_CONSTRAINT
- OFFER_CONSTRAINT
- ACQUISITION_CONSTRAINT
- CREATIVE_CONSTRAINT
- CONVERSION_CONSTRAINT
- RETENTION_CONSTRAINT
- INVENTORY_CONSTRAINT
- OPERATIONS_CONSTRAINT
- FINANCIAL_CONSTRAINT
- DATA_CONSTRAINT
- TECHNOLOGY_CONSTRAINT
- TEAM_CONSTRAINT
- STRATEGY_CONSTRAINT

---

## 12. Binding Status

Debe poder distinguir:

- BINDING_CONSTRAINT
- SECONDARY_CONSTRAINT
- LATENT_CONSTRAINT

---

## 13. Constraint Nature

Puede representar:

- HARD_CONSTRAINT
- SOFT_CONSTRAINT
- STRUCTURAL_BOTTLENECK
- TEMPORARY_CONSTRAINT

---

## 14. Target Dependency

Todo constraint debería poder asociarse al target que limita:

- revenue;
- profitability;
- cash;
- growth;
- throughput;
- stability;
- another defined business output.

---

## 15. Constraint Test

Debe poder representar:

- candidate constraint;
- target;
- evidence;
- falsifier;
- counterfactual question;
- result.

---

## 16. Constraint Sequence

Puede existir:

- primary;
- secondary;
- latent;

sin convertirlo en prioridad de intervención.

---

## 17. Scoped Constraints

Debe soportar constraints por:

- market;
- region;
- channel;
- product;
- capability;
- operational unit.

---

## 18. Serial / Parallel Constraints

El modelo debe poder representar:

- serial constraints;
- parallel constraints.

---

## 19. Controllability

Valores:

- CONTROLLABLE
- PARTIALLY_CONTROLLABLE
- EXTERNAL

---

## 20. Reversibility

Valores:

- EASILY_REVERSIBLE
- REVERSIBLE
- DIFFICULT
- UNKNOWN

---

## 21. Positive Driver

Puede existir una causa positiva ligada a una mejora.

---

## 22. No Constraint

Debe poder expresarse que un caso no tiene business constraint relevante.

---

## 23. Root Cause / Constraint Independence

Debe permitirse:

- root cause known + constraint unknown;
- constraint known + root cause unknown;
- root cause resolved + constraint active;
- constraint resolved + structural driver active.

---

## 24. Admin Trace

Debe poder reconstruirse:

- target;
- symptom;
- immediate cause;
- root cause;
- underlying driver;
- constraint;
- confidence;
- coverage;
- residual.

---

## 25. Boundaries

D9 no debe producir como hechos finales:

- severity;
- priority;
- playbook/action;
- impact ranking.

---

## 26. Elementos no definidos

No están definidos:

- JSON Schema;
- DB schema;
- exact confidence formula;
- exact constraint scoring;
- graph persistence;
- exact contribution formula;
- APIs;
- orchestration protocol.
