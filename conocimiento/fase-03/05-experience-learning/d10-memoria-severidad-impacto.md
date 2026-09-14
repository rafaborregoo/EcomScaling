# Fase 03 · D10 — Experience & Learning de severidad e impacto

## Propósito

D10 produce histórico valioso sobre cómo el daño evoluciona, se acumula, se propaga y es absorbido por cada tenant.

Este conocimiento permanece tenant-specific salvo gobernanza posterior.

---

## 1. Severity History

Debe conservarse evolución de:

- overall severity;
- severity vector;
- scope;
- trajectory;
- exposure;
- confidence.

---

## 2. Impact Timeline

Puede conservar:

- anomaly onset;
- material damage onset;
- severity escalation;
- containment;
- recovery;
- resolution.

---

## 3. Acute vs Cumulative Learning

El histórico permite aprender diferencia entre:

- instantaneous severity;
- cumulative damage.

Un issue moderado crónico puede superar a un incidente breve crítico en impacto total.

---

## 4. Recurrence Learning

Incidentes recurrentes pueden revelar:

- structural severity;
- recurring exposure;
- repeated damage;
- weak buffers.

---

## 5. Buffer Exhaustion History

Puede conservarse:

- cash buffer consumption;
- inventory days cover;
- spare capacity;
- creative buffer;
- redundancy activation.

---

## 6. Tenant-specific Time-to-Damage

Con historial puede observarse cuánto tarda un tipo de problema en producir daño material en ese tenant.

Ejemplos:
- backlog → SLA breach;
- creative weakness → CAC deterioration;
- stock coverage decline → stockout.

---

## 7. Propagation History

Puede almacenarse qué downstream effects aparecieron después de determinados incidents.

No convierte automáticamente correlación histórica en causalidad; D7/D9 siguen gobernando causal claims.

---

## 8. Recoverability Learning

Puede observarse:
- qué porcentaje del daño se recuperó;
- cuánto tardó;
- qué pérdidas fueron irreversibles.

---

## 9. Absorption Capacity Learning

La historia puede mostrar cuánto shock absorben:

- cash buffers;
- stock;
- operations;
- alternate channels;
- redundant systems.

---

## 10. Severity Calibration

F9 puede estudiar:
- over-severity;
- under-severity;
- realized vs projected impact error;
- forecast bias;
- confidence calibration.

---

## 11. Quantification Accuracy

Puede compararse:
- estimated loss;
- actual realized impact posterior;
- range coverage;
- model bias.

Esto permite mejorar futuras estimaciones sin fingir precisión.

---

## 12. Risk Realization

Puede registrarse si:
- revenue-at-risk se materializó;
- projected stockout ocurrió;
- continuity threat se evitó;
- buffers fueron suficientes.

---

## 13. Positive Recovery Patterns

También debe conservarse:
- containment;
- de-escalation;
- buffer restoration;
- recovery trajectory.

---

## 14. Severity by Context

El tenant puede aprender que el mismo issue tiene distinto impacto según:
- season;
- channel;
- product;
- promotion;
- cash state;
- redundancy.

---

## 15. Boundaries

D10 no define:
- automatic cross-tenant promotion;
- automatic risk probability calibration;
- reinforcement learning;
- autonomous priority;
- autonomous intervention.

Esos mecanismos pertenecen a capas/fases posteriores.
