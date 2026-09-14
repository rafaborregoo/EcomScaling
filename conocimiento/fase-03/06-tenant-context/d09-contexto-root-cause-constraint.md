# Fase 03 · D09 — Tenant context para Root Cause & Constraint

## Propósito

Contexto específico del ecommerce necesario para validar causas y determinar constraints binding.

No contiene valores concretos de ningún cliente.

---

## 1. Business Model

Determina qué constraints pueden ser relevantes.

Ejemplos:

### DTC físico
- inventory;
- fulfillment;
- working capital.

### Subscription
- billing;
- retention.

### Marketplace
- supply/demand liquidity;
- matching.

---

## 2. Current Target

Debe conocerse qué target se evalúa:

- revenue;
- profitability;
- cash;
- growth;
- throughput;
- stability;
- customer value.

El constraint depende del target.

---

## 3. Capability Capacity

Puede incluir:

- creative production capacity;
- warehouse throughput;
- support capacity;
- team bandwidth;
- inventory replenishment capacity;
- payment capacity.

---

## 4. Demand on Capability

Puede incluir:

- orders/hour;
- tickets/day;
- creative consumption rate;
- inventory depletion rate;
- work arrival rate.

---

## 5. Business Exposure

Necesario para:

- magnitude fit;
- blast radius;
- explanatory coverage.

---

## 6. Maturity Context

D3 puede aportar:

- current maturity;
- required maturity;
- structural gaps.

Un gap solo es constraint si está binding actualmente.

---

## 7. Health Context

D4 aporta:
- health;
- trajectory;
- exposure.

Una capability healthy puede ser latent constraint al próximo nivel de escala.

---

## 8. Historical Root Causes

El tenant puede tener:
- previous validated causes;
- recurring causes;
- structural drivers.

El historial completo pertenece a experience-learning.

---

## 9. Historical Constraints

Puede existir memoria de:
- previous bottlenecks;
- migration;
- resolution;
- next constraint.

---

## 10. Critical Path

El tenant puede definir nodos esenciales según su modelo:
- checkout;
- payment;
- stock;
- fulfillment;
- billing;
- supplier;
- other.

---

## 11. Economic Guardrails

Para constraints económicos:
- sustainable CAC;
- contribution floor;
- cash minimum;
- working-capital limits;
- margin requirements.

---

## 12. Inventory Context

Puede incluir:
- lead times;
- stock coverage;
- hero SKU exposure;
- supplier dependency;
- replenishment cadence.

---

## 13. Operations Context

Puede incluir:
- warehouse capacity;
- staffing;
- carrier dependency;
- SLA;
- backlog.

---

## 14. Team / Ownership Context

Puede ser relevante para structural drivers:
- owner;
- backup;
- process maturity;
- decision rights.

---

## 15. Technology / Data Context

Puede incluir:
- deployment process;
- config governance;
- tracking architecture;
- observability;
- integration dependencies.

---

## 16. Controllability Context

El tenant puede distinguir:
- internal;
- partially controllable;
- external factors.

---

## 17. Reversibility Context

Puede variar según:
- supplier terms;
- deployment rollback;
- stock lead time;
- contract;
- operational constraints.

---

## 18. Scope Hierarchy

Debe poder localizar causas y constraints por:
- market;
- channel;
- product;
- SKU;
- warehouse;
- device;
- payment method;
- team.

---

## 19. Exclusiones

No pertenecen a tenant-context:
- universal root cause definitions;
- global constraint taxonomy;
- current diagnosis state;
- root cause ledger completo;
- global causal rules.
