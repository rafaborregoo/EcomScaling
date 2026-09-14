# Fase 04 · P05 — Requisitos contractuales de constraints y dependencias

## Estado

P05 es `RAG / KNOWLEDGE`.

No define schemas técnicos, tablas, APIs ni objetos formalmente implementados.

Este archivo recoge requisitos conceptuales para que futuros contratos representen correctamente constraints y dependencies.

---

## 1. Constraint Representation

Debería poder representar conceptualmente:

- constraint candidate;
- objective/target;
- scope;
- type;
- status;
- current/emerging/future;
- binding evidence;
- confidence;
- demand on capacity;
- available capacity;
- saturation;
- queue/backlog;
- throughput blocked;
- release value;
- falsifier;
- next likely constraint.

---

## 2. Constraint Role

Debe poder distinguir:

- PRIMARY CONSTRAINT
- NEAR-CONSTRAINT
- NON-CONSTRAINT
- POSSIBLE CONSTRAINT

y, temporalmente:

- CURRENT
- EMERGING
- FUTURE

La fuente no define enum técnico final.

---

## 3. Constraint Type

Debe poder representar:

- demand;
- product;
- offer;
- creative;
- acquisition;
- conversion;
- payment;
- inventory;
- supply;
- fulfillment;
- customer service;
- retention;
- cash;
- data;
- technology;
- team;
- management attention;
- market;
- policy/compliance.

---

## 4. Constraint Test

Debe poder conservar:

- counterfactual;
- expected throughput if unchanged;
- expected throughput if elevated;
- evidence;
- confidence;
- falsifier.

---

## 5. Constraint Stack / Shadow

Debe poder representar:

- primary constraint;
- near constraints;
- shadow constraint;
- constraint sequence;
- next-likely constraint.

---

## 6. Constraint Consumption

Debe poder asociar:

- scarce resource;
- work arriving;
- work processed;
- utilization;
- low-value consumption;
- high-value consumption;
- queue.

---

## 7. Constraint Pollution

Debe poder representar conceptualmente:
- low-value work consuming constraint;
- work that should be diverted/reduced.

---

## 8. Dependency Representation

Debería poder representar:

- upstream node;
- downstream node;
- dependency type;
- dependency strength;
- dependency certainty;
- prerequisite;
- blocker;
- enabling relation;
- unlock value;
- alternative path;
- substitutability;
- switching lead time;
- redundancy;
- slack;
- critical path status.

---

## 9. Dependency Types

Debe poder representar conceptualmente:

- INFORMATION
- RESOURCE
- TECHNICAL
- OPERATIONAL
- FINANCIAL
- SUPPLY
- ORGANIZATIONAL
- APPROVAL
- MARKET
- TEMPORAL
- LEARNING
- VALIDATION

---

## 10. Dependency Strength

Puede distinguir:

- HARD
- STRONG
- MODERATE
- WEAK

---

## 11. Dependency Certainty

Debe distinguir:

- CONFIRMED
- HYPOTHESIZED

u otra representación equivalente.

---

## 12. Blocker

Debe poder representar:

- blocked candidate;
- blocker;
- blocking reason;
- what downstream value is blocked;
- unblock condition.

---

## 13. Minimum Viable Prerequisite

Debe poder representar:

- prerequisite;
- minimum sufficient state;
- whether partial execution can begin.

---

## 14. Shared Resource Conflict

Debe poder representar:

- candidate A;
- candidate B;
- shared scarce resource;
- demand from each;
- whether parallel execution is possible.

---

## 15. Critical Path

Debe poder representar:

- nodes;
- ordering;
- total duration;
- zero-slack nodes;
- slack;
- deadline dependence.

---

## 16. Parallelism

Debe poder indicar:
- can run in parallel;
- partially parallel;
- mutually exclusive due to shared resource.

---

## 17. Centrality

Puede representar:
- downstream dependency count;
- centrality concept;
- without treating it as automatic priority.

---

## 18. Single Point of Failure

Debe poder representar:
- node;
- value exposure;
- redundancy;
- alternative;
- switching time;
- dependency concentration.

---

## 19. Dependency Health

Puede representar conceptualmente:
- HEALTHY;
- FRAGILE;
- CRITICAL;

según:
- reliability;
- redundancy;
- control;
- switching cost.

---

## 20. Control

Debe distinguir:
- controllable;
- influenceable;
- uncontrollable.

---

## 21. Common-mode Failure

Debe poder representar:
- apparently redundant nodes;
- shared upstream dependency;
- common failure mode.

---

## 22. Constraint Loop

Debe poder representar:
- mutually reinforcing constraints;
- loop path;
- evidence;
- candidate break points.

No implica que P05 seleccione intervention.

---

## 23. Dependency Debt

Debe poder representar, si se implementa:
- organizational;
- technical;
- supplier;
- channel;
- complexity/coordination debt.

---

## 24. Constraint Release

Debe poder conservar:
- expected system output before;
- expected output after;
- realized output after;
- next constraint.

---

## 25. Dynamic Graph

Debe poder versionarse conceptualmente por:
- `as_of`;
- context;
- current constraint;
- active blockers;
- dependencies;
- graph changes.

---

## 26. Traceability

Toda relación material debería poder explicar:
- evidence;
- confidence;
- why dependency exists;
- why constraint is binding;
- what would falsify it;
- downstream implications.

---

## 27. Boundary

P05 no define:

- JSON Schema;
- graph database;
- exact centrality formula;
- exact constraint score;
- automatic optimizer;
- scheduling engine;
- project plan;
- playbook;
- API.

No deben inventarse.
