# Fase 03 · D10 — Requisitos contractuales de severidad e impacto

## Estado

La fuente define entidades, dimensiones y estados conceptuales claros, pero no un schema técnico definitivo.

---

## 1. Severity Assessment

Debería poder representar:

- diagnosis/case reference;
- overall severity;
- severity confidence;
- scope;
- target;
- current impact;
- future risk;
- trajectory;
- duration;
- onset;
- velocity;
- recurrence;
- business exposure;
- blast radius;
- reversibility;
- recoverability;
- absorption capacity;
- limitations.

---

## 2. Severity Levels

Debe soportar:

- INFO
- LOW
- MODERATE
- HIGH
- CRITICAL
- BUSINESS_THREAT

---

## 3. Severity Profile

Debe poder separar:

- acute severity;
- cumulative severity;
- forward risk;
- structural severity;
- overall severity.

---

## 4. Impact Vector

Debe poder representar por dimensión:

- revenue;
- contribution;
- cash;
- customer;
- operations;
- brand;
- strategic;
- continuity;
- data/decision impact cuando aplique.

---

## 5. Impact Timing

Debe poder distinguir:

- REALIZED
- ONGOING
- POTENTIAL
- PROJECTED

---

## 6. Impact Evidence Type

Debe poder marcar:

- OBSERVED
- ESTIMATED
- INFERRED
- FORECAST

---

## 7. Revenue Impact

Posibles elementos:

- gross revenue impact;
- net revenue impact;
- revenue at risk;
- realized loss;
- loss rate;
- accumulated loss;
- recoverability.

---

## 8. Contribution Impact

Debe poder representar:

- contribution loss;
- contribution compression;
- contribution at risk;
- contribution loss rate.

---

## 9. Cash Impact

Puede incluir:

- cash burn;
- working capital pressure;
- cash lockup;
- payment delay;
- liquidity risk;
- runway/buffer horizon.

---

## 10. Customer Impact

Puede representar:

- users affected;
- orders affected;
- customers affected;
- checkout exposure;
- active customer exposure;
- friction;
- failed purchase;
- delay;
- poor experience;
- refund;
- churn risk;
- trust damage.

---

## 11. Operational Impact

Puede incluir:

- backlog;
- SLA breach;
- capacity loss;
- manual workload;
- service interruption;
- error propagation.

---

## 12. Brand / Strategic / Continuity

Debe soportar dimensiones separadas para:

- brand;
- strategic initiatives;
- business continuity.

---

## 13. Business Exposure

Debe poder asociar:

- denominator type;
- exposure share;
- affected segment;
- confidence.

Denominadores posibles:

- revenue;
- contribution;
- spend;
- orders;
- customers;
- traffic;
- inventory value;
- other relevant base.

---

## 14. Blast Radius

Debe poder representar:

- direct capabilities affected;
- downstream capabilities;
- propagation risk;
- systemic propagation flag/assessment.

---

## 15. Duration / Velocity

Debe poder conservar:

- active duration;
- deterioration velocity;
- impact acceleration;
- recovery trajectory.

---

## 16. Reversibility

D10 consume la reversibility de D9 y puede usarla en severity evaluation.

---

## 17. Recoverability

Debe poder expresar qué parte del daño puede recuperarse.

La fuente no define un enum final obligatorio.

---

## 18. Time-to-Damage

Debe poder representar:

- time to material damage;
- time to threshold;
- time to buffer exhaustion.

---

## 19. Quantification

Un impacto cuantificado debería poder incluir:

- metric;
- value;
- range;
- unit;
- period;
- method;
- baseline/counterfactual;
- confidence;
- assumptions.

---

## 20. Quantification Quality

Debe distinguir:

- EXACT
- ESTIMATED
- RANGE
- DIRECTIONAL
- UNKNOWN

---

## 21. Loss Rates

Puede representar:

- loss_per_hour;
- loss_per_day;
- loss_per_week;
- contribution_loss_rate;
- cash_burn_rate;
- customer_damage_rate;
- operations_damage_rate.

---

## 22. Opportunity Cost

Debe mantenerse separado de realized loss.

Puede incluir:

- opportunity constrained;
- estimated upside blocked;
- confidence.

---

## 23. Risk

Puede representar:

- likelihood qualitative;
- impact;
- forward risk;
- scenario range.

No debe asumir probabilidades exactas no calibradas.

---

## 24. Buffers

Debe poder referenciar:

- cash buffer;
- inventory buffer;
- capacity buffer;
- creative buffer;
- redundancy;
- safety stock;
- backup provider;
- spare capacity.

---

## 25. Absorption Capacity

Debe poder representar capacidad del tenant para absorber shock.

---

## 26. Impact Graph

Debe poder asociar:

- root cause;
- direct impact;
- secondary impact;
- business outcome;
- quantified flow cuando exista.

---

## 27. Cause vs Impact Confidence

Debe mantener separados:

- root cause confidence;
- impact confidence;
- severity confidence.

---

## 28. Boundaries

D10 no debe emitir como salida final:

- priority;
- recommended action;
- playbook;
- effort ranking;
- business intervention order.

---

## 29. Elementos no definidos

No están definidos:

- JSON Schema;
- exact severity formula;
- exact impact weighting;
- monetary model universal;
- exact risk probability model;
- DB schema;
- API;
- alerting policy.
