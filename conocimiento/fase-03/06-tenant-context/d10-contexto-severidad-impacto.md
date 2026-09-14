# Fase 03 · D10 — Tenant context para severidad e impacto

## Propósito

Contexto específico del ecommerce necesario para calcular business exposure, impacto económico, buffers y continuidad.

No contiene valores concretos de ningún tenant.

---

## 1. Business Model

Modifica:
- critical paths;
- impact dimensions;
- continuity risks;
- relevant denominators.

---

## 2. Revenue Structure

Puede requerir:
- revenue by market;
- product/SKU;
- channel;
- customer type;
- geography;
- subscription/one-off.

---

## 3. Contribution Structure

Puede incluir:
- gross margin;
- contribution;
- COGS;
- discounts;
- shipping subsidy;
- payment fees;
- refunds;
- acquisition cost.

---

## 4. Cash Context

Puede incluir:
- runway;
- available cash;
- working capital;
- obligations;
- supplier payments;
- payroll;
- taxes;
- debt;
- inventory commitments.

---

## 5. Customer Value

Para weighting:
- LTV;
- VIP segments;
- customer contribution;
- cohort value.

---

## 6. Business Exposure Denominators

El tenant puede definir qué denominator es relevante por diagnosis:
- revenue;
- contribution;
- spend;
- customers;
- orders;
- traffic;
- inventory value.

---

## 7. Strategic Context

Puede incluir:
- market expansion;
- profitability goals;
- inventory reduction;
- retention goals;
- key launches.

Esto afecta strategic impact, no priority final.

---

## 8. Critical Capabilities

Puede existir registry específico de:
- checkout;
- payment;
- inventory;
- fulfillment;
- billing;
- data;
- other critical paths.

---

## 9. Buffers

Puede incluir:
- cash buffer;
- safety stock;
- warehouse spare capacity;
- backup provider;
- alternate supplier;
- alternate channel;
- technical redundancy;
- creative inventory.

---

## 10. Lead Times

Necesarios para time-to-damage:
- supplier lead time;
- replenishment;
- warehouse recovery;
- technical rollback;
- cohort maturity.

---

## 11. Recoverability Context

Puede depender de:
- product type;
- purchase intent;
- backorderability;
- customer willingness to retry;
- contractual terms;
- operational capacity.

---

## 12. Revenue / Contribution Baselines

D2 puede aportar baselines contextuales:
- historical;
- seasonal;
- promotional;
- forecast.

---

## 13. Risk Tolerance

Puede existir configuración sobre:
- liquidity;
- continuity;
- stock;
- service;
- margin.

No debe convertirse en priority automáticamente.

---

## 14. Scope Hierarchy

Puede incluir:
- market;
- channel;
- device;
- product;
- SKU;
- customer segment;
- warehouse;
- supplier;
- payment method.

---

## 15. Redundancy

Debe conocerse:
- backup systems;
- alternate providers;
- spare capacity;
- supplier alternatives.

---

## 16. Historical Recurrence

Puede existir referencia a incidents previos para:
- structural severity;
- likelihood;
- time-to-damage.

El historial completo pertenece a experience-learning.

---

## 17. Quantification Inputs

Puede incluir:
- AOV;
- orders/hour;
- net revenue;
- contribution/order;
- failure rate;
- affected traffic;
- refund cost;
- inventory value.

---

## 18. Data Reliability

D1 limita qué cuantificaciones pueden considerarse fiables.

---

## 19. Settlement / Open-period Context

Necesario para evitar medir impacto sobre periodos aún no asentados.

---

## 20. Exclusiones

No pertenecen a tenant-context:
- severity taxonomy universal;
- impact principles;
- current severity state;
- historical severity ledger completo;
- global severity rules.
