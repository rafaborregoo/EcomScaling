# Fase 04 · P03 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `P03-urgencia-y-sensibilidad-temporal.md`

**Identidad interna:**
- Fase 4 — Priorización y Decisión
- P3 — Urgencia y Sensibilidad Temporal

---

## 2. Naturaleza

La fuente se identifica como:

`RAG / KNOWLEDGE`

No contiene contrato técnico formal.

Por tanto:
- RAG es la capa principal;
- runtime recoge el proceso temporal inferible;
- contracts se limita a requisitos conceptuales;
- tenant-context contiene lead times, calendars, forecasts y capacidades concretas.

---

## 3. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `p03-urgencia-y-sensibilidad-temporal.md` | Copia exacta. |
| `01-rag-produccion` | `p03-urgencia-y-sensibilidad-temporal.md` | Knowledge estable de urgency/time sensitivity. |
| `02-contratos-IA` | `p03-requisitos-contrato-urgencia-temporal.md` | Requisitos de representación; sin schema inventado. |
| `03-runtime` | `p03-flujo-evaluacion-urgencia-temporal.md` | Secuencia conceptual de evaluación temporal. |
| `04-policies-guardrails` | `p03-guardrails-urgencia-temporal.md` | Anti-patterns, precision y deadline discipline. |
| `05-experience-learning` | `p03-memoria-temporal-y-latencias.md` | Lead times reales, recurrence, recovery, detection/response latency. |
| `06-tenant-context` | `p03-contexto-temporal-tenant.md` | Calendars, lead times, inventory, cash, capacity, exposure y forecasts. |
| `99-auditoria` | `p03-manifest-clasificacion.md` | Auditoría completa. |

---

## 4. RAG

Incluye:
- urgency definition;
- time sensitivity;
- time to damage;
- damage velocity/acceleration;
- cliffs/thresholds;
- compounding;
- persistent/recoverable damage;
- cost-of-delay curves;
- decision deadlines;
- intervention windows;
- time to irreversibility;
- lead times;
- opportunity expiry;
- deadline types;
- validation budget;
- value of waiting;
- temporal dependencies;
- slack;
- capacity/queue dynamics;
- cash timing;
- early warning;
- forecast actionability;
- preventive prioritization;
- preemption/firefighting;
- temporal portfolio;
- detection/response latency;
- recurrence/recovery;
- sequence-sensitive value;
- temporal counterfactuals.

---

## 5. Contracts

No se inventan objetos técnicos.

Se recogen requisitos para representar:
- timing ranges;
- CoD;
- windows;
- lead times;
- recovery;
- dependencies;
- slack;
- validation time budget;
- forecast confidence;
- temporal exposure;
- incident profile;
- freshness;
- uncertainty.

---

## 6. Runtime

El flujo conceptual incluye:
- current state;
- trajectory;
- time-to-damage;
- damage velocity;
- cost-of-delay;
- threshold;
- intervention window;
- lead times;
- irreversibility;
- recoverability;
- opportunity expiry;
- dependencies/slack;
- parallelism;
- resource conflicts;
- information value;
- freshness;
- recurrence;
- scenarios;
- feasibility;
- reassessment.

---

## 7. Guardrails

Se preservan separaciones duras:
- impact ≠ urgency;
- severity ≠ urgency;
- urgency ≠ priority;
- event date ≠ decision deadline;
- no damage ≠ no urgency;
- request urgency ≠ business urgency;
- forecast ≠ fact;
- long-term ≠ later;
- artificial deadline ≠ economic urgency.

---

## 8. Experience-learning

Justificado por:
- actual lead times;
- detection latency;
- response latency;
- recovery;
- recurrence;
- incident profiles;
- warning horizon;
- forecast timing accuracy;
- seasonal timing;
- preemption/firefighting history.

No se inventa:
- weight learning;
- auto-escalation;
- cross-tenant model;
- scheduler.

---

## 9. Tenant-context

P03 es muy dependiente de datos locales:
- lead times;
- event calendar;
- stock coverage;
- future demand;
- supplier cutoffs;
- creative cycles;
- cash obligations;
- processing capacity;
- hourly exposure;
- recovery time;
- resource conflicts.

Estos valores no deben ir al RAG global.

---

## 10. Conceptos multi-capa

### Time to Damage
- RAG: meaning.
- Contract: representability/range.
- Runtime: estimation.
- Guardrail: no false precision.
- Experience: forecast accuracy.
- Tenant: actual forecasts.

### Lead Time
- RAG: principle.
- Contract: decision/execution/result separation.
- Runtime: total response time.
- Experience: actual historical lead time.
- Tenant: supplier/creative/engineering times.

### Cost of Delay
- RAG: concept/curve.
- Contract: requirement.
- Runtime: temporal comparison.
- Guardrail: no linear assumption.
- Experience: realized delay impact.
- Tenant: economic inputs.

### Recovery
- RAG: recoverability.
- Contract: representation.
- Runtime: temporal feasibility.
- Experience: historical recovery.
- Tenant: actual recovery characteristics.

---

## 11. Fronteras

### P03 vs D10
- D10 measures damage/severity.
- P03 measures how time changes decision value.

### P03 vs P00
- P00 defines priority as multi-dimensional.
- P03 supplies the temporal dimension.

### P03 vs later ranking blocks
- P03 does not rank all candidates by itself.
- Urgency alone cannot determine priority.

### P03 vs F5
- P03 may recognize prevent/contain/adapt phase conceptually.
- Concrete actions/playbooks remain F5.

---

## 12. Numeración

La numeración principal es continua de 1 a 258.

No se detectan saltos estructurales.

---

## 13. Pérdida de información

No se detecta pérdida relevante.

El corpus exacto queda preservado.

Los ejemplos se han condensado en reglas temporales y patrones reutilizables sin alterar sus distinciones principales.

---

## 14. Decisiones arquitectónicas

1. P03 es principalmente RAG.
2. No se inventa schema técnico.
3. Time-to-damage, intervention window y lead time deben permanecer separados.
4. Urgency nunca se convierte en priority automáticamente.
5. Experience-learning se limita a temporal history real.
6. Tenant-context es crítico porque urgency depende de timings específicos.
7. False precision temporal queda prohibida.
8. No se inventa alerting/scheduling/automation ausente.
