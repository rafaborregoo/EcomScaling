# Fase 03 · D04 — Experience & Learning de salud

## Propósito

D4 contiene una base clara de aprendizaje temporal porque mantiene estados, monitoriza transiciones y conserva memoria de salud.

---

## 1. Health history

Debe conservarse histórico de:

- capability;
- scope;
- health state;
- trajectory;
- risk;
- evidence;
- timestamp/period;
- baseline;
- exposure.

Esto permite comparar el organismo consigo mismo.

---

## 2. Stateful consulting

La IA no debería analizar siempre desde cero.

Debe poder recordar patrones como:

- Creative lleva tres semanas deteriorándose;
- Inventory se recuperó después de una crisis;
- Acquisition suele volverse frágil cuando sube determinada concentración.

---

## 3. Baseline learning

El histórico permite aprender:

- normal state;
- typical volatility;
- recovery patterns.

Este aprendizaje no debe confundirse con benchmarks universales.

---

## 4. Recovery patterns

El sistema puede observar:

- cuánto tarda una capability en recuperarse;
- si recovery es estable;
- si existe relapse;
- si ciertas señales adelantadas predicen deterioro.

La fuente no define todavía un algoritmo de forecasting.

---

## 5. Health memory

La memoria puede almacenar:

- transiciones de health;
- duration in state;
- warnings previos;
- findings recurrentes;
- recovery episodes;
- chronic weakness;
- acute failures.

---

## 6. Pattern repetition

Con suficiente historial, puede estudiarse:

- qué deterioros suelen preceder a otros;
- qué combinaciones se repiten;
- qué capabilities son persistentemente frágiles;
- qué recovery patterns son típicos del tenant.

---

## 7. Chronicity

El historial permite distinguir:

- acute failure;
- chronic weakness;
- chronic fragility;
- health debt.

Sin dimensión temporal estas categorías serían débiles.

---

## 8. Trajectory learning

Trajectory no debe derivarse de una observación aislada.

Debe surgir de la evolución temporal de:

- health;
- metrics;
- leading indicators;
- exposure;
- warnings.

---

## 9. Business-specific baselines

La memoria del tenant puede mejorar self baselines y typical volatility.

Esto permite reducir dependencia de benchmarks genéricos.

---

## 10. Experience boundaries

Este documento no define:

- promotion de experiencias a RAG global;
- cross-tenant learning;
- decay;
- causal learning automático;
- reinforcement;
- auto-remediation.

Esos mecanismos deberán formalizarse en fases posteriores.

---

## 11. Relación con F9

D4 prepara material para aprendizaje posterior:

- historical health;
- deterioration sequences;
- recovery speed;
- recurring patterns;
- warning effectiveness.

F9 puede usarlo, pero D4 solo debe capturar y conservar la experiencia.
