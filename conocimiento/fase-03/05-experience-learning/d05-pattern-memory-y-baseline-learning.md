# Fase 03 · D05 — Experience & Learning de señales

## Propósito

D5 genera memoria temporal útil para aprender patrones del propio ecommerce sin convertirlos automáticamente en conocimiento universal.

---

## 1. Signal history

Debe conservarse histórico de:

- signal type;
- metric;
- capability;
- scope;
- onset;
- magnitude;
- duration;
- trajectory;
- confidence;
- exposure;
- linked events;
- outcome posterior cuando exista.

---

## 2. Baseline learning

El histórico permite aprender:

- normal ranges;
- typical volatility;
- recurring seasonality;
- usual response curves;
- recovery patterns.

Este aprendizaje debe permanecer tenant-specific salvo proceso posterior de promoción.

---

## 3. Baseline adaptation

Un baseline puede evolucionar cuando se confirma un `REGIME_SHIFT`.

Pero la adaptación requiere cautela para no normalizar fallos.

La experiencia histórica debe ayudar a distinguir:

- temporary anomaly;
- persistent shift;
- broken state.

---

## 4. Historical Pattern Matching

D5 puede buscar episodios anteriores similares.

Ejemplo:

> same pattern occurred before stockout

El match histórico debe aumentar contexto, no confirmar automáticamente el mismo desenlace.

---

## 5. Tenant-specific Pattern Library

Cada ecommerce puede desarrollar:

- `known_signal_patterns`

Ejemplos:

- Monday backlog spike;
- pre-stockout coverage pattern;
- seasonal CAC movement;
- recurring payment instability.

---

## 6. Novelty learning

El sistema puede aprender si una señal es:

- first-ever;
- rare;
- common;
- recurring.

Esto ayuda a ajustar attention y suppression.

---

## 7. Suppression memory

Una señal conocida y explicada puede recibir menor atención.

Debe conservarse:

- motivo de suppression;
- patrón;
- contexto;
- vigencia;
- evidencia que la justificó.

No debe silenciarse permanentemente sin revisión.

---

## 8. Recovery patterns

El histórico puede mostrar:

- cuánto duran anomalías;
- cómo se recuperan;
- qué leading indicators preceden recuperación;
- qué signals reaparecen.

---

## 9. Event-response learning

Puede conservarse la respuesta observada después de eventos:

- price change;
- deployment;
- promotion;
- channel shift.

Esto ayuda a construir conocimiento operativo específico del tenant.

---

## 10. Leading-indicator validation

Con suficiente historial puede analizarse si una leading signal realmente precede con frecuencia a un deterioro posterior.

Ejemplos:

- creative velocity ↓ antes de CAC ↑;
- stock coverage ↓ antes de stockout;
- backlog ↑ antes de SLA failure.

D5 registra evidencia; fases posteriores formalizan aprendizaje.

---

## 11. Pattern outcomes

Cuando exista outcome posterior, una experiencia puede vincular:

- signal pattern;
- context;
- event;
- later health state;
- later symptom;
- eventual outcome.

---

## 12. Boundaries

Este documento no define:

- cross-tenant learning;
- automatic promotion to global RAG;
- decay;
- reinforcement learning;
- causal model updating;
- automatic action.

Estos mecanismos pertenecen a fases posteriores.
