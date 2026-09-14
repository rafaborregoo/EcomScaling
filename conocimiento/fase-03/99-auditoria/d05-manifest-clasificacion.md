# Fase 03 · D05 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D05-motor-de-senales-y-anomalias.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D5 — Motor de Señales y Anomalías

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d05-motor-de-senales-y-anomalias.md` | Copia exacta del original. |
| `01-rag-produccion` | `d05-motor-de-senales-y-anomalias.md` | Framework experto de signals/anomalies. |
| `02-contratos-IA` | `d05-requisitos-contrato-senales.md` | Requisitos conceptuales de Signal Object, clusters, evidence y scopes. |
| `03-runtime` | `d05-flujo-motor-senales.md` | Pipeline de detección, contextualización, deduplicación y monitoring. |
| `04-policies-guardrails` | `d05-guardrails-senales.md` | Límites de detección, causalidad, thresholds y alerting. |
| `05-experience-learning` | `d05-pattern-memory-y-baseline-learning.md` | Pattern history, baseline adaptation, novelty y tenant-specific patterns. |
| `06-tenant-context` | `d05-configuracion-motor-senales.md` | Guardrails, baselines, frequencies, exposure y windows específicos del tenant. |
| `99-auditoria` | `d05-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

D05 es simultáneamente fuerte en RAG y Runtime.

El RAG contiene conocimiento estable sobre:

- signal taxonomy;
- anomaly families;
- trends;
- change points;
- regime shifts;
- expected ranges;
- statistical detection;
- signal relevance;
- deduplication;
- corroboration;
- decompositions;
- segments;
- multi-modal signals;
- leading indicators;
- composite signals;
- pattern matching.

Runtime contiene el pipeline que convierte observaciones en signal cards y clusters.

---

## 4. Experience-learning

Sí existe contenido real.

Motivos:

- baseline adaptation;
- historical pattern matching;
- tenant-specific pattern library;
- novelty;
- recurring patterns;
- suppression;
- event-response history.

No se genera aprendizaje cross-tenant ni causal learning porque la fuente no lo define.

---

## 5. Conceptos multi-capa

### Baseline

- RAG: principios de multi-baseline y adaptation.
- Contrato: referencias intercambiables.
- Runtime: selección y comparación.
- Experience: aprendizaje/adaptación.
- Tenant: baseline concreto.
- Guardrail: no normalizar fallos.

### Guardrail

- RAG: concepto.
- Contrato: información.
- Runtime: crossing/breach detection.
- Tenant: límites propios.
- Guardrail layer: no universalizar.

### Signal Pattern

- RAG: patrones generales.
- Runtime: matching.
- Experience: patrones históricos del tenant.
- Tenant: known pattern library.

### Exposure

- RAG: principio.
- Contrato: requisito.
- Runtime: business relevance.
- Tenant: pesos reales.

### Signal Cluster

- RAG: deduplication concept.
- Contrato: estructura.
- Runtime: agrupación.
- Guardrail: no convertir cluster en síntoma.

---

## 6. Contenido consolidado

Se consolidaron:

- observation/variation/signal/anomaly;
- tipos de signal;
- level/trend/change/rate/acceleration;
- volatility/stability;
- concentration;
- mix;
- ratios;
- capacity/dependency;
- positive/risk/regression;
- persistence;
- change point/regime/baseline adaptation;
- statistical protection;
- deduplication/corroboration/conflict;
- residual/context-aware anomalies;
- mathematical decomposition;
- segment detection;
- multi-modal signals;
- event-linked signals;
- leading indicators;
- composite signals;
- anomaly families;
- novelty/pattern matching;
- D4/D5 loop;
- horizon/frequency;
- exposure/impact.

---

## 7. Contenido excluido del RAG

No se embebe como conocimiento universal:

- baselines concretos;
- current signals;
- tenant thresholds;
- known patterns concretos;
- actual exposure;
- runtime state;
- suppression state;
- observed event-response history.

---

## 8. Fronteras arquitectónicas

### D5 vs D4

- D4 mantiene health state.
- D5 detecta cambios.
- Forman un loop operativo.

### D5 vs D6

- D5 genera signals/clusters.
- D6 genera symptoms.

### D5 vs causalidad

- Mathematical contribution no es causal attribution.
- Event-linked no significa caused-by.

### D5 vs recomendación

D5 no prescribe acciones.

---

## 9. Irregularidades de numeración

El documento original contiene numerosos saltos, entre ellos:

- 32 → 42;
- 45 → 47;
- 55 → 58;
- 64 → 66;
- 71 → 73;
- 79 → 83;
- 87 → 89;
- 91 → 103;
- 128 → 151;
- 187 → 195;
- 206 → 210;
- 222 → 233;
- 236 → 239;
- 241 → 243;
- 248 → 256;
- 274 → 299;
- 299 → 308;
- 310 → 312.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El corpus original queda preservado íntegramente.

Los ejemplos se han condensado en patrones de razonamiento y se conservan los conceptos que justificaban.

---

## 11. Decisiones arquitectónicas

1. D5 debe tener RAG fuerte de detection rules.
2. Signal Object y Signal Cluster requieren contrato conceptual.
3. La detección y scheduling pertenecen a runtime.
4. No-premature-causality debe ser guardrail.
5. Historical pattern matching y baseline adaptation justifican experience-learning.
6. Thresholds, guardrails y monitoring windows concretos pertenecen al tenant.
7. D5 termina en señales; D6 empieza en síntomas.
8. No se inventan scoring formulas, schemas ni algorithms ausentes.
