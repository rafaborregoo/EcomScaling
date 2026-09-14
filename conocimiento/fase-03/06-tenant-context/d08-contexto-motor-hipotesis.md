# Fase 03 · D08 — Tenant context del motor de hipótesis

## Propósito

Contexto específico de cada ecommerce necesario para generar priors, contrastar explanations y elegir tests diagnósticos útiles.

No contiene datos concretos de ningún tenant.

---

## 1. Business Model

Puede modificar:

- prior plausibility;
- candidate families;
- causal mechanisms;
- expected lags;
- diagnostic relevance.

---

## 2. Maturity

D3 aporta maturity específica.

Un structural explanation puede ser más plausible si la capability está por debajo del required maturity, pero no queda confirmada por ello.

---

## 3. Health

D4 aporta health state.

Una capability ELITE con evidence fuerte puede debilitar una broad failure hypothesis.

---

## 4. Scope Hierarchy

Puede incluir:

- market;
- channel;
- campaign;
- audience;
- creative;
- device;
- browser;
- product;
- SKU;
- cohort;
- payment method;
- warehouse;
- supplier.

---

## 5. Business Events

Contexto como:

- price changes;
- promotions;
- deployments;
- launches;
- budget changes;
- stockouts;
- supplier incidents;
- configuration changes.

---

## 6. Available Evidence Sources

Puede incluir:

- Shopify;
- Meta;
- Google;
- GA;
- Stripe/payment logs;
- support tickets;
- reviews;
- warehouse systems;
- ERP;
- CRM;
- deployment logs.

---

## 7. Tool Availability

D8 debe saber qué evidencia puede obtener automáticamente antes de preguntar al usuario.

---

## 8. Experimentation Capabilities

Contexto sobre:

- A/B testing;
- rollback capability;
- feature flags;
- control markets;
- staged rollout;
- device/segment split.

---

## 9. Business Criticality

La profundidad de investigación puede depender de:

- revenue exposure;
- cash exposure;
- customer impact;
- continuity risk;
- transaction criticality.

---

## 10. Historical Tenant Cases

Puede existir referencia a:

- previous symptoms;
- previous hypotheses;
- previous validated root causes;
- prior outcomes.

El historial completo pertenece a experience-learning.

---

## 11. Tenant Priors

Pueden existir priors locales derivados de history.

Deben estar claramente separados de global heuristics.

---

## 12. Expected Relationships

Algunos mechanisms pueden variar según:

- business model;
- market;
- product;
- channel;
- region.

---

## 13. Time Windows

La validez de evidence depende de:

- event horizon;
- cohort horizon;
- campaign cadence;
- inventory cycle;
- payment timing;
- retention window.

---

## 14. Economic Context

Puede afectar magnitude fit:

- margin;
- contribution;
- CAC tolerance;
- inventory exposure;
- AOV;
- LTV;
- cash constraints.

---

## 15. Known Constraints

Pueden orientar hypotheses estructurales:

- team capacity;
- creative supply;
- inventory;
- warehouse;
- working capital;
- supplier dependence.

---

## 16. User-provided Context

Preguntas al usuario solo cuando:
- el dato no está disponible automáticamente;
- tiene high information gain;
- es necesario para discriminación.

---

## 17. Exclusiones

No pertenecen a tenant-context:

- universal hypothesis principles;
- guardrails;
- current hypothesis ledger;
- current evidence state;
- global hypothesis library;
- agent calibration history completa.
