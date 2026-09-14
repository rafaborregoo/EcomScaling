# Fase 03 · D09 — Experience & Learning de Root Causes y Constraints

## Propósito

D9 genera memoria estructurada de causas y constraints validados o parcialmente soportados. Este histórico alimenta F9 sin convertir automáticamente experiencia local en conocimiento global.

---

## 1. Root Cause History

Debe conservar:

- cause code;
- scope;
- type;
- family;
- confidence;
- evidence;
- recurrence;
- active/resolved;
- downstream effects;
- outcome.

---

## 2. Recurring Root Cause

Si una causa reaparece, registrar:

- RECURRENT.

La recurrencia puede justificar investigar structural driver.

---

## 3. Structural Driver Learning

Varios casos con distintas immediate causes pueden compartir un underlying driver.

Ejemplo:

múltiples stockouts:
- under-ordering;
- delayed PO;
- missed promo uplift;

pueden revelar un forecasting process deficit.

---

## 4. Constraint History

Debe conservarse:

- constraint type;
- target;
- scope;
- start/end;
- binding evidence;
- resolution;
- next constraint.

---

## 5. Constraint Migration

F9 podrá aprender:

> what constraint usually appears next

Ejemplo:

- Creative constraint resolved
- Inventory becomes binding

---

## 6. Constraint Sequence

Puede almacenarse:

- primary;
- secondary;
- latent;
- next-emerged.

Esto crea conocimiento operativo sobre scaling.

---

## 7. Recovery Learning

Debe registrarse cuando:

- root cause resolves;
- constraint persists;
- constraint resolves;
- structural driver persists.

Esta separación ayuda a entender recurrencia real.

---

## 8. Intervention Validation

Cuando una intervención elimina el symptom, puede conservarse como evidencia histórica fuerte.

Debe registrarse también:

- simultaneous changes;
- controls;
- uncertainty.

---

## 9. Positive Driver Learning

También se almacenan causal chains de mejora.

Ejemplos:

- new creative concept → CTR ↑ → CAC ↓;
- bundle adoption → AOV ↑ → contribution ↑.

---

## 10. Constraint Removal Learning

Puede conservarse cuánto throughput se desbloqueó tras eliminar un constraint.

La cuantificación detallada puede pertenecer a fases posteriores.

---

## 11. Root Cause Calibration

Puede medirse posteriormente:

- how often probable roots were confirmed;
- false root closures;
- recurrence rate;
- time to resolution;
- residual after closure.

---

## 12. Tenant-specific Cause Patterns

Con suficiente historial puede crecer un mapa local de:

- common root causes;
- recurring structural drivers;
- likely next constraints;
- typical recovery paths.

No debe promoverse automáticamente a RAG global.

---

## 13. Scope-specific Learning

Una causa puede repetirse solo en:

- market;
- channel;
- warehouse;
- product;
- payment method.

Debe conservarse scope.

---

## 14. Root Cause / Constraint Pair Memory

Pares históricos pueden ser útiles:

- root: forecast underestimation;
- constraint: inventory availability.

Esto ayuda a futuras investigaciones sin confirmar de antemano el mismo patrón.

---

## 15. Boundaries

D09 no define:

- automatic cross-tenant promotion;
- decay;
- reinforcement learning;
- autonomous remediation;
- automatic global graph mutation.

Estos mecanismos requieren gobernanza posterior.
