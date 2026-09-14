# Fase 04 · P04 — Requisitos contractuales de impacto decisional

## Estado

P04 es `RAG / KNOWLEDGE`.

No define schemas técnicos, enums formales ni APIs.

Este archivo contiene únicamente requisitos conceptuales de representación futura.

---

## 1. Impact Assessment

Un futuro objeto de impacto debería poder representar:

- candidate reference;
- value type;
- impact type;
- realized value;
- potential value;
- value at risk;
- value to protect;
- value to recover;
- value to unlock;
- value to enable;
- risk-reduction value;
- horizon;
- scope;
- confidence;
- assumptions;
- evidence refs.

---

## 2. Impact Profile

Debería poder representar:

- what value;
- how much;
- whose value;
- where;
- when;
- duration;
- mechanism.

---

## 3. Economic Value Types

Debe poder representar conceptualmente:

- revenue;
- gross profit;
- contribution;
- operating profit;
- cash;
- working capital;
- customer lifetime value;
- inventory;
- operational capacity;
- strategic value;
- optionality;
- resilience;
- learning;
- reputation;
- risk exposure.

No se define enum técnico final.

---

## 4. Realized / Potential / Recoverable / Irrecoverable

Debe poder distinguir:

- REALIZED;
- POTENTIAL;
- RECOVERABLE;
- IRRECOVERABLE.

---

## 5. Direct / Indirect / Current / Forward

Debe poder representar:

- direct impact;
- indirect impact;
- current impact;
- forward impact;
- first/second/higher-order effects.

---

## 6. Measured / Inferred / Potential

Debe poder diferenciar:

- MEASURED;
- INFERRED;
- POTENTIAL.

---

## 7. Baseline / Counterfactual

Debe poder conservar:

- baseline type;
- baseline period;
- expected trajectory;
- counterfactual method;
- assumptions;
- seasonality adjustment;
- confidence.

---

## 8. Relative and Absolute Magnitude

Debe poder representar:

- percentage impact;
- absolute value;
- business-relative materiality.

---

## 9. Exposure

Puede requerir:

- revenue exposure;
- contribution exposure;
- order exposure;
- customer exposure;
- traffic exposure;
- geographic exposure;
- device exposure;
- product exposure;
- channel exposure.

---

## 10. Value Density

Debe poder asociar exposición con:

- contribution;
- CLV;
- margin;
- strategic weight.

---

## 11. Customer Value

Debe poder separar:

- order value;
- revenue CLV;
- contribution CLV;
- cohort value;
- new vs existing customer value.

---

## 12. Cash / Working Capital

Debe poder representar:

- cash at risk;
- liquidity blocked;
- working capital;
- payment timing;
- payback;
- obligations.

---

## 13. Inventory Value

Debe poder representar:

- purchase cost;
- sales value;
- contribution potential;
- cash tied up;
- obsolescence;
- strategic availability.

---

## 14. Incrementality

Debe poder representar:

- gross impact;
- incremental impact;
- cannibalization;
- substitution;
- recapture;
- deferred demand;
- lost demand.

---

## 15. Opportunity

Debe poder representar:

- theoretical opportunity;
- addressable value;
- capturable value;
- economic capture;
- opportunity capacity;
- saturation;
- marginal value.

---

## 16. Resilience / Optionality / Enabling / Learning

Debe poder representar cualitativamente o cuantitativamente cuando exista evidencia:

- resilience value;
- optionality value;
- enabling value;
- learning value;
- dependency value.

No deben monetizarse artificialmente.

---

## 17. Blast Radius / Concentration

Debe poder representar:

- blast radius;
- critical path;
- concentration type;
- concentration share;
- redundancy;
- common dependency.

---

## 18. Constraint Release Value

Debe poder representar:

- current throughput;
- constrained throughput;
- estimated unlocked throughput;
- next constraint risk.

---

## 19. Frequency / Duration / Recurrence

Debe poder representar:

- impact per event/unit;
- frequency;
- duration;
- recurrence;
- persistence;
- decay/compounding.

---

## 20. Scenario Analysis

Debe poder representar:

- best;
- base;
- downside;
- upside;
- range;
- tail scenario.

---

## 21. Confidence

Debe poder separar:

- diagnosis confidence;
- impact confidence;
- attribution confidence;
- assumption sensitivity.

---

## 22. Impact Overlap

Debe poder representar:

- overlapping value;
- shared customers;
- shared revenue;
- shared constraint;
- double-count risk.

---

## 23. Correlated Downside

Debe poder representar:

- common dependency;
- systemic exposure;
- correlated impact.

---

## 24. Explainability

Toda estimación material debería poder explicar:

- why high/medium/low;
- mechanism;
- exposure;
- recoverability;
- assumptions;
- uncertainty.

---

## 25. Boundary

P04 no define:

- JSON Schema;
- exact impact score;
- universal value metric;
- probability model;
- DB schema;
- accounting engine;
- attribution engine;
- API;
- final ranking formula.
