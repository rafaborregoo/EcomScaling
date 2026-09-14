# Fase 03 · D09 — Root Cause & Constraint Engine

## Propósito

D9 responde:

> ¿Cuál es la causa suficientemente soportada del problema, cuál es el mecanismo intermedio y qué parte del sistema está limitando actualmente el resultado?

Debe distinguir:

`SYMPTOM → IMMEDIATE CAUSE → ROOT CAUSE → UNDERLYING DRIVER`

y, por separado:

`CURRENT CONSTRAINT`

Estas piezas no son equivalentes.

---

# 1. Root Cause

Una `ROOT_CAUSE` es:

> La causa más profunda que la evidencia actual permite sostener de forma útil y cuya existencia explica coherentemente el mecanismo que produjo el problema investigado.

Debe ser:

- sufficiently deep;
- supported;
- specific;
- diagnostically useful.

No debe buscarse la explicación filosóficamente más profunda si añade poca utilidad.

---

# 2. Root Cause Depth

Puede modelarse conceptualmente:

- D0 — Outcome
- D1 — Surface Driver
- D2 — Immediate Cause
- D3 — Root Cause
- D4 — Structural Driver

Ejemplo:

- D0: Revenue ↓
- D1: CVR ↓
- D2: Payment completion ↓
- D3: Payment config regression
- D4: No checkout deployment validation

---

# 3. Immediate Cause

La `IMMEDIATE_CAUSE` es el mecanismo inmediatamente anterior al efecto investigado.

Ejemplo:

`Payment errors ↑ → Payment success ↓`

Immediate cause:

- payment authentication errors.

---

# 4. Intermediate Cause

Puede haber varios niveles intermedios.

Ejemplo:

`Creative pipeline ↓ → Creative concentration ↑ → CTR ↓ → CAC ↑`

Creative concentration y CTR decline pueden ser intermediate causes.

---

# 5. Underlying Driver

El `UNDERLYING_DRIVER` describe una condición más estructural que favorece recurrencia.

Ejemplos:

- no clear ownership of creative production;
- inventory planning maturity below business complexity;
- no deployment validation process.

No siempre debe existir.

---

# 6. Stop Too Early / Stop Too Late

### Demasiado temprano

> CAC rose because CTR fell.

Puede ser correcto, pero superficial.

### Demasiado tarde

> CAC rose because organizational culture does not prioritize innovation.

Demasiado abstracto salvo evidencia fuerte.

### Profundidad adecuada

La causa debe explicar el mecanismo, ser verificable y añadir utilidad diagnóstica.

---

# 7. Root Cause Confidence

Estados conceptuales:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT

`CONFIRMED` debe ser excepcional.

Evidence fuerte puede incluir:

- direct system evidence;
- intervention;
- control comparison;
- configuration diff;
- logs;
- independent corroboration.

Muchas investigaciones deben terminar correctamente en:

- PROBABLE;
- PARTIAL_ROOT_CAUSE;
- UNRESOLVED.

---

# 8. Partial Root Cause

Puede ocurrir:

- Cause A explains 55 %
- Cause B explains 25 %
- 20 % remains unexplained

Resultado:

- `PARTIAL_ROOT_CAUSE`

No debe forzarse una explicación total.

---

# 9. Root Cause Evidence Hierarchy

De mayor a menor fuerza:

1. DIRECT SYSTEM EVIDENCE
2. INTERVENTION
3. CONTROL COMPARISON
4. MULTI-SOURCE CORROBORATION
5. TEMPORAL + MECHANISTIC FIT
6. PATTERN MATCH
7. HEURISTIC ONLY

---

# 10. Evidence-guided Depth

El razonamiento tipo “Five Whys” solo es válido si cada salto tiene una upstream branch causal plausible y evidence.

No debe profundizarse mecánicamente hasta explicaciones vagas.

---

# 11. Root Cause Families

Familias:

- MARKET
- PRODUCT
- OFFER
- ECONOMICS
- ACQUISITION
- CREATIVE
- CONVERSION
- RETENTION
- INVENTORY
- OPERATIONS
- FINANCE
- DATA
- TECHNOLOGY
- TEAM
- STRATEGY
- EXTERNAL

---

# 12. Root Cause Types

Tipos:

- ACUTE
- CHRONIC
- STRUCTURAL
- EVENT_DRIVEN
- PROCESS
- CAPACITY
- CONFIGURATION
- QUALITY
- PLANNING
- DEPENDENCY
- EXTERNAL
- POSITIVE_DRIVER

---

# 13. Primary / Secondary / Contributing Root Cause

Puede existir:

- `PRIMARY_ROOT_CAUSE`
- `SECONDARY_ROOT_CAUSE`
- `CONTRIBUTING_CAUSE`

Esto permite representar multicausalidad.

---

# 14. Recurring Root Cause

Si la misma causa reaparece:

- `RECURRING_ROOT_CAUSE`

La recurrencia aumenta la importancia de investigar underlying structural drivers.

---

# 15. Systemic Root Cause

Una causa puede afectar múltiples capabilities.

Ejemplo:

- ausencia de data ownership

puede degradar:

- tracking;
- finance metrics;
- attribution;
- decisions.

Los claims sistémicos requieren evidencia más fuerte.

---

# 16. Root Cause Scope

La causa debe mantener scope preciso.

No:

> The business has poor operations.

Sí:

> Return processing capacity in the Spanish warehouse is below current weekly return volume.

---

# 17. Active vs Resolved Cause

Una root cause puede estar:

- active;
- resolved.

El diagnóstico histórico debe persistir aunque el problema desaparezca.

---

# 18. Validation by Intervention

Si corregir la causa elimina el síntoma, causal confidence aumenta.

Pero si varias cosas cambian a la vez, persiste confounding.

Debe registrarse:

> what else changed?

---

# 19. Constraint Definition

Un `CONSTRAINT` es:

> La parte del sistema que actualmente limita el resultado, throughput, crecimiento, eficiencia o estabilidad del negocio.

Pregunta:

> ¿Qué capacidad está poniendo el techo ahora mismo?

---

# 20. Root Cause ≠ Constraint

Ejemplo:

- Root Cause: forecast underestimated demand.
- Constraint: inventory availability.

Forecasting originó el problema, pero el límite actual es la ausencia de stock.

---

# 21. Constraint Types

Como mínimo:

- DEMAND_CONSTRAINT
- PRODUCT_CONSTRAINT
- OFFER_CONSTRAINT
- ACQUISITION_CONSTRAINT
- CREATIVE_CONSTRAINT
- CONVERSION_CONSTRAINT
- RETENTION_CONSTRAINT
- INVENTORY_CONSTRAINT
- OPERATIONS_CONSTRAINT
- FINANCIAL_CONSTRAINT
- DATA_CONSTRAINT
- TECHNOLOGY_CONSTRAINT
- TEAM_CONSTRAINT
- STRATEGY_CONSTRAINT

---

# 22. Weakness ≠ Constraint

No toda debilidad limita el target actual.

Una capability débil puede no ser binding.

---

# 23. Constraint ≠ Priority

El constraint actual no determina automáticamente qué debe atacarse primero.

La priorización pertenece a F4.

Puede coexistir:

- structural constraint: Inventory;
- critical immediate issue: Payment outage.

---

# 24. Binding Constraint

`BINDING_CONSTRAINT`:

> límite actualmente activo sobre el target.

---

# 25. Latent Constraint

`LATENT_CONSTRAINT`:

> todavía no limita el output actual, pero probablemente lo hará al siguiente nivel de escala.

Ejemplo:

creative production suficiente a €50k/month pero insuficiente a €100k/month.

---

# 26. Throughput Thinking

Puede modelarse el ecommerce como red:

`Demand → Traffic → Conversion → Orders → Fulfillment → Retention → Cash`

El constraint es el componente que limita el throughput relevante.

---

# 27. Constraint Shift

Al corregir un constraint, otro puede emerger.

Ejemplo:

`Acquisition fixed → Orders grow → Inventory becomes constraint`

Los constraints migran con el sistema.

---

# 28. Constraint Evidence

Indicadores frecuentes:

- capacity saturation;
- queue/backlog;
- resource scarcity;
- stock shortage;
- marginal efficiency collapse;
- dependency bottleneck;
- hard guardrail breach.

---

# 29. Hard Constraint vs Soft Constraint

### Hard

Ejemplo:
- zero stock.

El output es físicamente imposible.

### Soft

Ejemplo:
- CAC empeora rápidamente al escalar.

El output sigue siendo posible, pero económicamente poco atractivo.

---

# 30. Constraint Counterfactual

Pregunta central:

> Si esta restricción desapareciera manteniendo el resto igual, ¿podría mejorar materialmente el target?

Si no, probablemente no es binding.

---

# 31. Constraint is Target-dependent

El constraint depende del target.

Ejemplos:

Para Revenue Growth:
- Inventory puede ser constraint.

Para Profitability:
- CAC puede ser constraint.

Para Cash:
- Working Capital puede ser constraint.

No existe un universal constraint único.

---

# 32. Primary / Secondary / Latent Constraint

Puede haber:

- PRIMARY_CONSTRAINT
- SECONDARY_CONSTRAINT
- LATENT_CONSTRAINT

Esto permite representar constraint sequence.

---

# 33. Constraint by Domain

## Demand
Demanda/tráfico insuficiente.

## Offer
Product y traffic existen, pero offer response es débil.

## Creative
Budget/economics permiten escalar, pero no hay suficiente winning creative supply.

## Conversion
Traffic abundante, pero el funnel no convierte.

## Retention
Repeat/LTV limitan economics.

## Inventory
Demand > available supply.

## Operations
Order capacity < demand.

## Finance
Cash impide crecimiento económicamente atractivo.

## Data
La organización no puede decidir con fiabilidad.

## Team
Execution queue crece por capacity/skill/ownership.

## Strategy
Resource fragmentation limita ejecución.

---

# 34. Constraint vs Capacity

Una capability con capacity baja no es automáticamente constraint.

Debe estar:

- binding.

---

# 35. Structural Constraint

Un constraint puede derivarse de un maturity gap persistente.

Concepto:

- `STRUCTURAL_BOTTLENECK`

---

# 36. Temporary Constraint

Ejemplo:

- carrier outage.

Puede ser binding sin ser structural.

---

# 37. Demand-on-Capability vs Available Capacity

Muchos constraints pueden modelarse como:

`DEMAND ON CAPABILITY > AVAILABLE CAPACITY`

Ejemplos:

- creative consumption rate > production rate;
- orders/hour > warehouse capacity/hour;
- demand velocity > replenishment;
- work arrival rate > execution capacity.

---

# 38. Queue as Constraint Evidence

Cuando existe queue/backlog, puede ser evidencia fuerte de binding capacity.

No todos los constraints requieren queue.

Un stockout puede ser binding sin backlog.

---

# 39. Economic Constraint

Puede manifestarse en marginal return curves.

Ejemplo:

spend ↑ y marginal CAC ↑ sharply.

---

# 40. Business-model-aware Constraint Registry

Subscription:

- billing;
- retention.

DTC físico:

- inventory;
- fulfillment.

El constraint registry debe adaptarse al modelo.

---

# 41. Constraint Blast Radius

Un constraint puede tener blast radius sobre varias capabilities.

Debe combinarse con exposure.

---

# 42. Root Cause Chains

Puede existir:

`STRUCTURAL_DRIVER → ROOT_CAUSE → IMMEDIATE_CAUSE → SYMPTOM → OUTCOME`

Ejemplo:

- Structural Driver: Forecasting capability below required maturity
- Root Cause: Promo demand excluded from forecast
- Immediate Cause: PO volume insufficient
- Symptom: Hero SKU stockout
- Outcome: Revenue decline

---

# 43. Root Cause Narrative

Una síntesis de calidad debe explicar:

- what happened;
- symptom;
- immediate cause;
- root cause;
- underlying driver;
- current constraint;
- confidence.

---

# 44. Causal Language Calibration

HIGH:

> La evidencia indica que...

MEDIUM:

> La causa más probable es...

LOW:

> Existe una explicación plausible...

INSUFFICIENT:

> No puede establecerse todavía una causa raíz.

No debe usarse lenguaje definitivo sin evidencia apropiada.

---

# 45. Multi-agent Root Cause Synthesis

Agentes especializados pueden aportar cadenas parciales.

Ejemplo:

- Acquisition Agent: CAC deterioration due to CVR decline
- Conversion Agent: CVR decline due to stock availability
- Inventory Agent: stock availability due to supplier delay

El orchestrator puede sintetizar:

- Root cause: supplier delay
- Current constraint: inventory availability
- Downstream effects: conversion / CAC

---

# 46. Canonical Cause Codes

Ejemplos:

- PAYMENT_CONFIG_REGRESSION
- HERO_SKU_STOCKOUT
- FORECAST_UNDERESTIMATION
- CREATIVE_PIPELINE_CAPACITY_SHORTFALL
- AUDIENCE_SATURATION
- PRICE_RESISTANCE
- FULFILLMENT_CAPACITY_SATURATION
- TRACKING_REGRESSION
- WORKING_CAPITAL_SHORTFALL

---

# 47. Constraint Tests

D9 puede generar pruebas diagnósticas para validar si una capability es realmente binding.

Ejemplo:

> Is demand materially higher on in-stock hero products than sellable supply?

---

# 48. Constraint Falsification

Debe poder preguntar:

> ¿Qué evidencia demostraría que esta capacidad NO es el constraint?

Ejemplo Inventory:
- si in-stock products muestran la misma collapse de conversion, Inventory pierde soporte como primary constraint.

---

# 49. Constraint Counterfactual

Idealmente:

`Remove constraint → estimate potential unlocked throughput`

La cuantificación avanzada puede pertenecer a F4/F6.

---

# 50. Root Cause Controllability

Puede clasificarse:

- CONTROLLABLE
- PARTIALLY_CONTROLLABLE
- EXTERNAL

Esto describe naturaleza, no recomendación.

---

# 51. Reversibility

Puede clasificarse:

- EASILY_REVERSIBLE
- REVERSIBLE
- DIFFICULT
- UNKNOWN

D10 podrá usar esta dimensión para severidad.

---

# 52. Root Cause Propagation

Puede registrarse:

- downstream capabilities;
- propagation path.

---

# 53. Constraint Conflict

Si varias capabilities parecen limitar:

> Which one currently prevents additional target output first?

Puede haber:

- serial constraints;
- parallel constraints;
- scoped constraints.

---

# 54. Serial Constraints

En sistemas secuenciales, el primer binding constraint puede dominar.

Ejemplo:

`Demand → Inventory → Fulfillment`

---

# 55. Parallel / Scoped Constraints

Puede existir simultáneamente:

- US → Inventory constraint
- EU → Acquisition constraint

No debe generalizarse al negocio entero.

---

# 56. Marginal Analysis

Especialmente útil en scaling.

Ejemplo:

- Spend ↑
- Marginal CAC ↑ sharply
- Creative winner inventory ↓

Puede señalar creative/acquisition constraint.

---

# 57. Root Cause Blame Avoidance

El diagnóstico debe describir:

- processes;
- capacities;
- configurations;
- mechanisms.

No culpar personas sin evidencia imprescindible.

Mejor:

> Budget was increased 120% without corresponding creative supply.

Peor:

> The media buyer caused the issue.

---

# 58. Human Error

Puede existir, pero debería expresarse como:

- configuration entered incorrectly

más que como juicio personal.

Si un error puede repetirse, el process weakness puede ser más útil, si existe evidencia.

---

# 59. Recurrence Check

Antes de cerrar una root cause:

> Has this root cause appeared before?

Si sí:

- registrar RECURRENT;
- investigar structural driver.

---

# 60. Contradiction Check

Antes de cerrar:

> What evidence would make this cause impossible?

---

# 61. Root Cause Known / Constraint Unknown

Es válido.

Ejemplo:
- tracking regression confirmada;
- ningún business constraint actual.

---

# 62. Constraint Known / Root Cause Unknown

También es válido.

Ejemplo:
- inventory availability es binding;
- aún no sabemos por qué falta inventario.

---

# 63. No Constraint Necessary

Algunos diagnostic cases no necesitan business constraint.

Ejemplo:
- isolated reporting bug.

---

# 64. Positive Diagnosis

D9 también puede identificar positive drivers.

Ejemplo:

`New bundle → AOV ↑ → Contribution ↑`

Root positive driver:
- bundle adoption.

Las cadenas positivas deben conservarse para learning.

---

# 65. Root Cause vs Opportunity

Una oportunidad no necesita root cause.

Una mejora observada sí puede tener positive driver.

---

# 66. D9 vs D10

D9 responde:

> ¿Cuál es la causa y cuál es el constraint?

D10 responderá:

> ¿Cuánto daño está causando realmente?

Por tanto:

`CAUSE ≠ SEVERITY ≠ PRIORITY`

---

# 67. Principio final

Un diagnóstico serio debe poder decir:

- este es el síntoma;
- este es el mecanismo inmediato;
- esta es la root cause soportada;
- este es el driver estructural;
- este es el current constraint.

Solo después puede evaluarse severidad, impacto y prioridad.
