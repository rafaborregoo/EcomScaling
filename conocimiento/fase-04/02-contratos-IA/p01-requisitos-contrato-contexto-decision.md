# Fase 04 · P01 — Requisitos contractuales del contexto de decisión

## Estado

P01 es un documento de `RAG / KNOWLEDGE`.

No define schemas, enums, tablas, APIs ni objetos técnicos implementados.

Por tanto, este archivo recoge únicamente **requisitos conceptuales** que cualquier futuro `DECISION_CONTEXT` deberá ser capaz de representar.

No se inventa un schema técnico.

---

## 1. Identidad del contexto

El contexto debe poder asociarse a:

- tenant/business;
- momento de evaluación;
- horizonte temporal;
- contexto estratégico vigente.

---

## 2. Objective Context

Debe poder representar conceptualmente:

- primary objective;
- secondary objectives;
- objective precedence;
- objective rationale;
- target state;
- time horizon;
- deadlines/event windows;
- objective importance;
- objective urgency.

---

## 3. Objective Provenance

Debe poder distinguir:

- declared objective;
- revealed objective;
- inferred objective;
- objective uncertainty.

La fuente no define enum técnico definitivo.

---

## 4. Objective Conflict

Debe poder registrar:

- conflicting objectives;
- incompatible requirements;
- trade-offs;
- precedence between objectives;
- unresolved conflict.

---

## 5. Goal / Target / Strategy / Initiative / Preference

El modelo futuro debe mantener separados:

- business goal;
- measurable target;
- strategy;
- initiative;
- preference.

No deben colapsarse en un solo campo semántico.

---

## 6. Objective Feasibility

Debe poder representar factores que afectan factibilidad:

- maturity;
- resources;
- constraints;
- capacity;
- time;
- risk capacity;
- commitments.

---

## 7. Current Reality

Debe poder referenciar:

- current business state;
- economic health;
- operational state;
- cash reality;
- unit economics;
- maturity;
- active constraints.

---

## 8. Guardrails

Debe poder representar:

- economic guardrails;
- operational guardrails;
- customer guardrails;
- strategic guardrails;
- continuity guardrails.

Cada guardrail debería poder tener:

- meaning;
- threshold/rule if actually known;
- status;
- provenance.

No deben inventarse thresholds ausentes.

---

## 9. Constraints

Debe poder referenciar:

- current constraint;
- relevant structural constraints;
- binding gaps.

Debe mantenerse separado de guardrails.

---

## 10. Resource Context

Debe poder representar disponibilidad/escasez de:

- cash;
- team;
- engineering;
- creative;
- inventory;
- suppliers;
- time;
- management attention.

---

## 11. Risk Context

Debe poder distinguir:

- risk appetite;
- risk capacity;
- risks the business can absorb;
- risks it cannot absorb.

---

## 12. Commitments

Debe poder representar:

- inventory orders;
- contracts;
- campaign launches;
- retailer commitments;
- product launches;
- market entries;
- technology migrations;
- future obligations;
- sunk costs;
- reversibility.

---

## 13. Time Context

Debe poder representar:

- decision horizon;
- seasonal window;
- event window;
- deadline;
- short-term vs long-term objective.

---

## 14. Must Win / Must Not Fail

El contexto debería poder expresar:

- MUST_WIN;
- MUST_NOT_FAIL;
- SHOULD_IMPROVE;
- NICE_TO_HAVE;

como categorías conceptuales.

La representación técnica queda abierta.

---

## 15. Core Economic Engine

Debe poder referenciar elementos críticos que generan valor:

- key products;
- channels;
- retention engines;
- operational dependencies;
- other business-specific drivers.

---

## 16. Concentration

Debe poder representar, cuando exista evidencia:

- revenue concentration;
- contribution concentration;
- channel concentration;
- supplier concentration;
- customer concentration.

---

## 17. Gap-to-Objective

Debe poder representar:

- current state;
- target state;
- identified gaps;
- binding gaps;
- non-binding gaps.

---

## 18. Context Confidence

Debe poder asociarse confidence a:

- objective clarity;
- current-state quality;
- constraint clarity;
- resource visibility;
- risk capacity;
- commitments;
- time window.

No existe fórmula de confidence definida en P01.

---

## 19. Context Freshness

Debe poder conocerse:

- when context was assessed;
- whether objectives changed;
- whether major events invalidated previous context.

---

## 20. Objective Change

Debe poder registrar conceptualmente:

- previous objective;
- new objective;
- trigger;
- materiality;
- effective time.

La fuente no define event schema.

---

## 21. Boundaries

P01 no define:

- technical JSON schema;
- database model;
- objective enum;
- ranking formula;
- priority score;
- objective weights;
- API;
- persistence strategy.

Estos elementos no deben inventarse.
