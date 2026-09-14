# Fase 03 · D05 — Requisitos contractuales del motor de señales

## Estado

La fuente define un vocabulario y estructuras conceptuales muy amplias, pero no un schema técnico definitivo.

No se inventan JSON Schema, tablas, interfaces ni endpoints.

---

## 1. Signal Object

Una señal debería poder representar, cuando aplique:

- signal type;
- capability;
- metric;
- scope;
- state;
- direction;
- magnitude;
- duration;
- onset;
- velocity;
- persistence;
- trajectory;
- business relevance;
- exposure;
- baseline;
- expected range;
- confidence;
- evidence;
- provenance.

---

## 2. Signal Types

El contrato debe poder distinguir:

- `LEVEL_SIGNAL`
- `TREND_SIGNAL`
- `CHANGE_SIGNAL`
- `RATE_SIGNAL`
- `VOLATILITY_SIGNAL`
- `CONCENTRATION_SIGNAL`
- `MIX_SIGNAL`
- `RATIO_SIGNAL`
- `CAPACITY_SIGNAL`
- `DEPENDENCY_SIGNAL`
- `REGRESSION_SIGNAL`
- `POSITIVE_SIGNAL`
- `RISK_SIGNAL`

La fuente no define un enum cerrado final.

---

## 3. Anomaly Types

Debe poder representar:

- `POINT_ANOMALY`
- `CONTEXTUAL_ANOMALY`
- `COLLECTIVE_ANOMALY`
- sequence anomaly;
- periodic anomaly;
- localized anomaly.

---

## 4. Persistence

Debe poder distinguir:

- transient;
- emerging;
- persistent;
- chronic.

---

## 5. Onset y change point

Debe poder registrar:

- detected onset;
- candidate change point;
- pre-change regime;
- post-change regime;
- evidence.

---

## 6. Regime

Debe poder distinguir:

- `NORMAL_REGIME`
- `NEW_REGIME`
- anomaly;
- `REGIME_SHIFT`.

El contrato no define algoritmo de confirmación.

---

## 7. Baselines

Debe poder asociar uno o varios baselines:

- WoW;
- historical median;
- YoY;
- forecast;
- contextual expected value;
- pre-event baseline.

Debe poder expresar conflicto o consenso entre baselines.

---

## 8. Expected Range

Información posible:

- expected low;
- expected high;
- contextual dimensions;
- reference period.

---

## 9. Business Guardrail

Debe poder representar:

- guardrail;
- current value;
- distance to guardrail;
- crossing direction;
- breach type;
- approaching status.

Tipos conceptuales:

- economic;
- operational;
- technical;
- risk.

---

## 10. Confidence

Debe poder diferenciar, cuando aplique:

- data confidence;
- context confidence;
- signal confidence;
- qualitative classification confidence.

---

## 11. Sample y statistical metadata

Debe poder conservar:

- sample size;
- event count;
- low-sample flag;
- statistical method;
- expected distribution/range;
- statistical strength.

No se define fórmula universal.

---

## 12. Business significance

Debe poder representar separadamente:

- statistical significance;
- business significance;
- exposure;
- preliminary impact estimate.

---

## 13. Signal Cluster

Debe poder agrupar varias señales en un `SIGNAL_CLUSTER`.

Información útil:

- member signals;
- shared scope;
- temporal overlap;
- metric dependency;
- cluster label;
- confidence.

D6 transformará clusters en síntomas.

---

## 14. Signal Conflict

Debe poder representar:

- signals/sources in conflict;
- expected relationship;
- observed disagreement;
- possible data signal;
- confidence degradation.

---

## 15. Corroboration

Debe poder expresar:

- independent corroborating sources;
- source independence;
- reinforcing evidence.

---

## 16. Metric Dependency

Debe poder conservar lineage/dependency entre métricas para evitar double counting.

D1 provee lineage.

---

## 17. Segment Scope

Una señal puede asociarse a:

- market;
- device;
- browser;
- channel;
- campaign;
- creative;
- product;
- SKU;
- customer type;
- cohort;
- landing page;
- payment method.

---

## 18. Segment Eligibility

Debe poder registrar:

- sample;
- business exposure;
- critical segment flag;
- high-value flag;
- eligibility result.

---

## 19. Event-linked Signal

Debe poder representar:

- business event;
- event timestamp;
- expected effect window;
- pre-event baseline;
- post-event values;
- lag;
- event-linked status.

No implica causalidad confirmada.

---

## 20. Leading Indicator

Debe poder indicar:

- leading_indicator;
- expected lag;
- downstream capability or metric;
- confidence.

---

## 21. Composite Signal

Debe poder identificar:

- component inputs;
- contribution of each input;
- formula or rule reference;
- explanation.

No se permiten scores opacos sin inputs explicables.

---

## 22. Signal Card

La fuente ejemplifica una salida conceptual con:

- signal;
- capability;
- state;
- magnitude;
- duration;
- trajectory;
- relevance;
- confidences.

No se considera schema implementado.

---

## 23. Correlation Window

Debe poder establecer ventanas dependientes del dominio.

No existe una ventana universal.

---

## 24. Novelty

Debe poder distinguir:

- first-ever;
- rare;
- common;
- recurring.

---

## 25. Pattern Match

Debe poder registrar:

- matched historical pattern;
- similarity/context;
- previous outcome cuando exista;
- attention/suppression state.

---

## 26. Tenant Pattern Library

Cada tenant puede mantener `known_signal_patterns`.

Esto no forma parte del RAG global.

---

## 27. Signal Impact Estimate

D5 puede emitir estimación preliminar:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Debe permanecer separada de prioridad final.

---

## 28. Boundaries

El output de D5 no debe afirmar:

- symptom final;
- root cause;
- action;
- recommendation.

---

## 29. Elementos no definidos

No están definidos:

- JSON schema;
- database schema;
- state machine final;
- formula de confidence;
- statistical thresholds;
- scoring weights;
- algorithm selection;
- persistence;
- API.
