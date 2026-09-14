# Fase 03 · D05 — Tenant context del motor de señales

## Propósito

Configuración específica de cada ecommerce necesaria para decidir qué cambios importan.

No contiene datos concretos de ningún tenant.

---

## 1. Business guardrails

Puede incluir:

- maximum sustainable CAC;
- margin floor;
- contribution limits;
- warehouse safe capacity;
- technical error tolerance;
- stock coverage buffer;
- cash thresholds.

No deben universalizarse.

---

## 2. Baselines

Contexto específico:

- historical median;
- WoW reference;
- YoY reference;
- forecast;
- expected seasonal range;
- promotion-adjusted baseline.

---

## 3. Expected ranges

Rangos dependientes de:

- weekday;
- season;
- market;
- channel;
- business stage;
- promotion;
- product;
- cohort.

---

## 4. Monitoring frequency

Por métrica/capability puede configurarse:

- real-time;
- hourly;
- daily;
- weekly;
- monthly.

La frecuencia debe ajustarse a la dinámica del fenómeno.

---

## 5. Correlation windows

Ventanas por dominio:

- payment: minutes/hours;
- ads: hours/days;
- retention: weeks/months;
- otros.

---

## 6. Event effect windows

Cada tipo de evento puede tener:

- expected effect window;
- lag range;
- metrics to monitor.

---

## 7. Segment hierarchy

El tenant puede tener dimensiones:

- market;
- channel;
- campaign;
- creative;
- device;
- browser;
- product;
- SKU;
- customer type;
- cohort;
- landing page;
- payment method.

---

## 8. Segment eligibility

Configuración:

- minimum sample;
- minimum business exposure;
- critical segment exceptions;
- high-value exceptions.

---

## 9. Exposure

Puede utilizar:

- business share affected;
- revenue exposure;
- profit exposure;
- customer exposure;
- operational exposure.

---

## 10. Critical capabilities

La relevancia de señales depende de:

- business model;
- channel dependency;
- product concentration;
- supplier structure;
- revenue concentration.

---

## 11. Known business events

Contexto:

- deployments;
- price changes;
- promotions;
- launches;
- supplier incidents;
- tracking changes;
- operational changes.

---

## 12. Known signal patterns

El tenant puede almacenar patrones ya observados:

- recurring;
- explained;
- high-risk;
- suppressed;
- seasonal.

---

## 13. Statistical configuration

Algunas métricas pueden requerir diferentes:

- statistical method;
- lookback;
- smoothing;
- robustness;
- seasonality handling.

No debe asumirse una configuración universal.

---

## 14. Metric graph

La arquitectura del tenant puede determinar:

- canonical metrics;
- formulas;
- lineage;
- dependency relationships.

D5 debe usar esta información para deduplication y decomposition.

---

## 15. Source independence

Debe conocerse qué fuentes son realmente independientes para signal corroboration.

---

## 16. Strategy

La business significance puede variar según objetivos actuales:

- growth;
- profitability;
- retention;
- cash protection;
- expansion;
- inventory reduction.

---

## 17. Exclusiones

No pertenecen a tenant-context:

- definiciones generales de signal/anomaly;
- detection principles;
- universal guardrails;
- runtime observations;
- signal history completo;
- global expert pattern library.
