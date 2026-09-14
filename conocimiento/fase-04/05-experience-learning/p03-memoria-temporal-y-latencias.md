# Fase 04 · P03 — Experience & Learning temporal

## Propósito

P03 contiene múltiples señales históricas que pueden convertirse en memoria temporal tenant-specific.

No define un motor de aprendizaje automático.

---

## 1. Actual Lead Times

Puede conservarse historial real de:

- supplier production;
- shipping;
- creative production;
- engineering;
- hiring;
- approvals;
- campaign learning;
- retention feedback.

Esto permite comparar expected vs actual lead time.

---

## 2. Detection Latency History

Conservar:

- event start;
- detected at;
- detection latency.

Ayuda a distinguir:
- issue became urgent;
- issue was detected late.

---

## 3. Response Latency History

Conservar:

- detection;
- decision;
- execution;
- recovery.

Puede revelar organizational latency.

---

## 4. Recovery Time

Histórico de:

- time to contain;
- time to stable recovery;
- recurrence after apparent recovery.

---

## 5. Recurrence Frequency

Puede conservar:
- frequency;
- interval;
- duration;
- severity;
- recovery.

La fuente menciona el concepto de mean time between failures sin exigir implementación formal.

---

## 6. Incident Temporal Profiles

Por tipo de incident:

- START;
- DURATION;
- FREQUENCY;
- RECOVERY;
- RECURRENCE.

---

## 7. Cost-of-Delay History

Puede compararse posteriormente:
- expected CoD;
- realized accumulated damage;
- curve shape;
- threshold crossing.

No se define fórmula automática.

---

## 8. Forecast Timing Accuracy

Puede conservarse:
- predicted window;
- actual event;
- best/base/downside coverage;
- warning horizon.

---

## 9. Warning Horizon Utility

Histórico puede mostrar si una señal llegó:
- too early but noisy;
- actionable;
- too late.

---

## 10. Buffer / Window Closure History

Puede conservar:
- intervention window estimate;
- actual window closure;
- whether option expired;
- whether action remained feasible.

---

## 11. Seasonal Temporal Patterns

Puede aprenderse histórico tenant-specific de:
- Black Friday;
- launches;
- promotions;
- seasonal demand;
- supplier cutoffs.

Sin generalizar automáticamente a otros tenants.

---

## 12. Creative Temporal History

Puede conservar:
- winner lifespan;
- fatigue onset;
- production lead time;
- replacement delay.

---

## 13. Inventory Temporal History

Puede conservar:
- coverage;
- velocity;
- lead time;
- stockout date;
- replenishment date;
- forecast error.

---

## 14. Queue Dynamics History

Puede observarse:
- incoming work;
- processing capacity;
- backlog growth;
- feedback effects.

---

## 15. Cash Temporal History

Puede conservar:
- burn velocity;
- obligations;
- runway;
- actual cash cliffs;
- working-capital cycle.

---

## 16. Preemption History

Puede registrar:
- priority interrupted;
- emergency reason;
- cost of preemption;
- date structural priority re-entered.

Esto puede revelar firefighting patterns.

---

## 17. Priority Debt History

Repeated deferrals pueden conservarse como evidence de:
- future emergency creation;
- rising remediation cost.

---

## 18. Decision Speed Calibration

Puede observarse si la organización:
- decides too slowly;
- overreacts too fast;
- matches velocity to environment.

---

## 19. Boundaries

P03 no define:
- automatic urgency weight learning;
- cross-tenant temporal model;
- reinforcement;
- autonomous scheduling;
- automated escalation policy.

Es memoria temporal para fases posteriores.
