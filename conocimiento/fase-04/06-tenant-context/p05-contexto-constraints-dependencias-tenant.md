# Fase 04 · P05 — Tenant context de constraints y dependencias

## Propósito

P05 depende intensamente de la estructura real del ecommerce.

Los valores concretos del constraint map y dependency graph deben vivir por tenant, no en RAG global.

---

## 1. Current Business Objective

Referencia al objective actual de P1.

Sin objective no puede determinarse binding constraint.

---

## 2. Capability Map

Puede incluir:
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
- service;
- retention;
- cash;
- data;
- technology;
- team;
- management;
- market;
- compliance.

---

## 3. Capacity by Capability

Cuando sea relevante:
- maximum capacity;
- current utilization;
- spare capacity;
- queue;
- demand arrival rate.

---

## 4. Current Constraint

Puede incluir:
- candidate;
- confidence;
- evidence;
- throughput effect;
- scope;
- status.

---

## 5. Near / Emerging / Future Constraints

Puede incluir:
- capacity forecast;
- planned growth load;
- threshold;
- expected timing.

---

## 6. Constraint Stack

Puede reflejar:
- primary;
- near constraints;
- shadow constraints;
- next likely constraint.

---

## 7. Shared Resources

Puede incluir:
- founder attention;
- engineering;
- creative;
- finance/cash;
- warehouse;
- legal;
- data;
- supplier capacity.

---

## 8. Queue / Backlog

Puede incluir:
- incoming work;
- processing capacity;
- backlog;
- waiting time;
- batching;
- scheduling issues.

---

## 9. Decision Rights

Puede incluir:
- who can decide;
- approval requirements;
- delegation;
- escalation;
- bottleneck owner.

---

## 10. Dependency Graph

Puede incluir actual relations:
- prerequisite;
- hard/soft;
- blocker;
- enablement;
- resource conflict;
- temporal dependency;
- validation dependency.

---

## 11. Dependency Type

Cada relation puede ser:
- information;
- resource;
- technical;
- operational;
- financial;
- supply;
- organizational;
- approval;
- market;
- temporal;
- learning;
- validation.

---

## 12. Dependency Strength / Confidence

Puede incluir:
- hard/strong/moderate/weak;
- confirmed/hypothesized.

---

## 13. Critical Path

Puede contener:
- nodes;
- deadlines;
- slack;
- zero-slack items;
- outcome blocked.

---

## 14. Parallelism

Puede reflejar:
- tasks that can run concurrently;
- shared resource conflicts;
- partial execution.

---

## 15. Minimum Viable Prerequisite

Puede indicar:
- what minimum state is enough;
- what does not need to be perfect.

---

## 16. Redundancy

Puede incluir:
- backup supplier;
- payment provider;
- warehouse;
- employee;
- data source;
- channel;
- technical service.

---

## 17. Redundancy Capacity

No basta que exista alternativa.

Puede incluir:
- max load;
- switching time;
- readiness;
- geographic/technical limits.

---

## 18. Single Points of Failure

Puede incluir:
- node;
- business exposure;
- alternative;
- switching lead time;
- control level.

---

## 19. External Dependencies

Puede incluir:
- suppliers;
- carriers;
- platforms;
- payment providers;
- marketplaces;
- regulators;
- agencies.

---

## 20. Control / Influence

Para cada dependency:
- controllable;
- influenceable;
- uncontrollable.

---

## 21. Switching Lead Times

Puede incluir:
- supplier;
- provider;
- logistics;
- technical service;
- key employee/knowledge.

---

## 22. Concentration

Puede incluir:
- supplier share;
- channel share;
- payment share;
- customer share;
- employee/process concentration.

---

## 23. Policy Constraints

Puede incluir:
- approval rules;
- procurement rules;
- compliance rules;
- internal decision policies.

---

## 24. Information Constraints

Puede incluir:
- missing metrics;
- data latency;
- low confidence;
- inaccessible source;
- lack of forecasting.

---

## 25. Learning / Feedback Constraints

Puede incluir:
- experiment cycle;
- measurement delay;
- post-analysis latency;
- ability to learn.

---

## 26. Complexity / Coordination

Puede incluir:
- number of markets;
- channels;
- tools;
- suppliers;
- workflows;
- handoffs;
- integrations.

---

## 27. Current Constraint Consumption

Puede incluir:
- what work consumes scarce resource;
- proportion high/low value;
- avoidable load.

---

## 28. System Flow

Puede representarse con:
- upstream;
- downstream;
- inputs;
- outputs;
- current accumulation;
- starvation;
- excess capacity.

---

## 29. Constraint Release Assumptions

Puede incluir:
- expected unlocked throughput;
- expected next bottleneck;
- exposure;
- dependency implications.

---

## 30. Forecast Context

Puede incluir:
- planned growth;
- campaign;
- seasonality;
- capacity forecast;
- stock;
- cash.

---

## 31. Context Freshness

Constraint/dependency context debe actualizarse ante:
- replenishment;
- capacity changes;
- hiring;
- supplier failure;
- new integrations;
- objective change;
- blocker resolution;
- market expansion.

---

## 32. Exclusiones

No pertenecen a tenant-context:
- universal constraint theory;
- generic dependency taxonomy;
- anti-patterns;
- universal decision rules;
- full historical constraint ledger.
