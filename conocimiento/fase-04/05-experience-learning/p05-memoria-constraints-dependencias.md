# Fase 04 · P05 — Experience & Learning de constraints y dependencias

## Propósito

P05 genera memoria especialmente valiosa sobre:

- constraint migration;
- actual bottlenecks;
- next-likely constraints;
- dependency failures;
- unlocks;
- queue dynamics;
- resource conflicts.

No define un motor de aprendizaje automático.

---

## 1. Constraint History

Puede conservar:
- hypothesized constraint;
- confidence;
- evidence;
- current/emerging/future;
- period active;
- resolution.

---

## 2. Constraint Validation Outcomes

Registrar:
- expected throughput increase;
- actual throughput increase;
- whether hypothesis was validated;
- false positive/false negative.

---

## 3. Constraint Migration

Conservar secuencias:

`A → B → C`

cuando el bottleneck cambia tras elevar el anterior.

Esto puede alimentar F9 con patrones tenant-specific.

---

## 4. Next-Constraint Accuracy

Puede compararse:
- predicted next constraint;
- actual next constraint;
- timing.

---

## 5. Constraint Shadow History

Registrar capabilities que parecían sanas y se volvieron bottleneck después de elevar otra.

---

## 6. Constraint Removal Test History

Después de improvement:
- local metric change;
- system output change;
- throughput release;
- new bottleneck.

---

## 7. Constraint Consumption History

Puede conservar:
- scarce resource;
- work mix;
- low-value work;
- high-value work;
- throughput per resource unit conceptually.

---

## 8. Queue Dynamics

Histórico de:
- arrival rate;
- processing rate;
- backlog;
- waiting time;
- queue cause.

Ayuda a distinguir capacity constraint de scheduling/coordination problems.

---

## 9. Dependency History

Puede conservar:
- dependency created;
- dependency resolved;
- dependency strengthened/weakened;
- alternative path introduced.

---

## 10. Blocker Resolution

Registrar:
- blocker;
- downstream items activated;
- unlock value realized;
- time to unblock.

---

## 11. Dependency Failure

Cuando falla:
- supplier;
- platform;
- payment provider;
- integration;
- person;

registrar downstream blast radius.

---

## 12. Redundancy Performance

Puede observarse:
- backup activated;
- % load absorbed;
- switching time;
- real vs theoretical redundancy.

---

## 13. Common-mode Failures

Conservar casos donde varias alternativas fallaron por shared dependency.

---

## 14. Critical Path Accuracy

Comparar:
- predicted critical path;
- actual delaying node;
- slack assumptions;
- schedule impact.

---

## 15. Parallelism Outcomes

Puede observarse:
- what ran in parallel;
- what was unnecessarily serialized;
- time/value saved.

---

## 16. Minimum Viable Prerequisite Learning

Puede registrarse qué nivel mínimo de prerequisite permitió avanzar de forma segura.

---

## 17. Dependency Debt

Histórico puede mostrar acumulación de:
- organizational;
- technical;
- supplier;
- channel;
- coordination dependencies.

---

## 18. Resource Conflict History

Puede registrar:
- shared resource;
- candidates competing;
- queue;
- allocation;
- resulting business throughput.

---

## 19. Decision Rights Bottleneck History

Puede observar:
- approval queue;
- founder dependency;
- delays;
- delegation effects.

---

## 20. External Dependency History

Puede registrar:
- reliability;
- switching lead time;
- alternative availability;
- failure frequency.

---

## 21. Constraint Loop History

Puede conservar loops observados:
- cash ↔ inventory;
- support ↔ fulfillment;
- other reinforcing dynamics.

Sin inferir automáticamente intervención óptima.

---

## 22. Dynamic Graph Snapshots

Puede conservar:

`DECISION GRAPH(t1)`
`DECISION GRAPH(t2)`

y cambios:
- new dependency;
- blocker removed;
- constraint migrated;
- redundancy added.

---

## 23. Priority Recalculation Events

Cuando cambia:
- current constraint;
- dependency;
- blocker;
- resource conflict;

registrar que el ranking anterior quedó obsoleto o requirió revisión.

---

## 24. Boundaries

P05 no define:
- automatic graph learning;
- cross-tenant constraint sequence promotion;
- reinforcement;
- autonomous scheduling;
- automatic intervention selection;
- graph neural network;
- weight learning.

Es memoria estructurada para calibración futura.
