# Fase 03 · D04 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D04-diagnostico-de-salud-por-capacidad.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D4 — Diagnóstico de Salud por Capacidad

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d04-diagnostico-de-salud-por-capacidad.md` | Copia exacta del original. |
| `01-rag-produccion` | `d04-diagnostico-de-salud-por-capacidad.md` | Framework experto de health por capability. |
| `02-contratos-IA` | `d04-requisitos-contrato-health.md` | Estados, dimensiones y requisitos conceptuales de intercambio. |
| `03-runtime` | `d04-flujo-diagnostico-health.md` | Secuencia operacional de evaluación y actualización. |
| `04-policies-guardrails` | `d04-guardrails-health.md` | Límites de interpretación y separación de responsabilidades. |
| `05-experience-learning` | `d04-health-memory-y-aprendizaje.md` | Health history, stateful consulting, baseline learning y recovery patterns. |
| `06-tenant-context` | `d04-contexto-health-ecommerce.md` | Baselines, guardrails, exposure, criticality y targets específicos del tenant. |
| `99-auditoria` | `d04-manifest-clasificacion.md` | Auditoría de clasificación. |

---

## 3. Capa principal

La capa dominante es `01-rag-produccion`.

D4 define conocimiento reusable sobre:

- health states;
- health dimensions;
- health por dominio;
- trajectory;
- resilience;
- exposure;
- dependencies;
- propagation risk;
- early warning;
- health horizon;
- leading/lagging indicators;
- health decomposition;
- aggregation;
- acute vs chronic;
- health debt;
- health/maturity matrix;
- criticality;
- impact vector;
- stateful health model.

---

## 4. Experience-learning

Sí existe contenido real y explícito.

La fuente introduce:

- monitoring;
- baseline learning;
- continuous state;
- digital twin;
- stateful consulting;
- health memory;
- recovery patterns;
- recurring deterioration patterns.

Esto justifica `05-experience-learning`.

No se inventan:

- cross-tenant learning;
- knowledge promotion;
- decay;
- auto-remediation;
- causal learning automático.

---

## 5. Conceptos multi-capa

### Health states

- RAG: significado experto.
- Contrato: estados intercambiables.
- Runtime: clasificación.
- Experience: evolución histórica.
- Tenant: interpretación contextual.

### Trajectory

- RAG: significado.
- Contrato: estados.
- Runtime: cálculo/actualización.
- Experience: histórico.
- Guardrail: no confundir health con trajectory.

### Exposure

- RAG: principio.
- Contrato: campo conceptual.
- Runtime: agregación.
- Tenant: peso real del negocio.

### Baseline

- RAG: self baseline first.
- Contrato: referencia de evaluación.
- Runtime: comparación.
- Experience: aprendizaje de normalidad.
- Tenant: baseline específico.

### Criticality

- RAG: depende del modelo.
- Contrato: requisito.
- Runtime: impacto.
- Tenant: registry específico.
- Guardrail: no universalizar.

### Health memory

- RAG: principio de stateful consulting.
- Runtime: persistencia/actualización.
- Experience: memoria histórica.

---

## 6. Contenido repetitivo consolidado

Se consolidaron:

- estados ELITE → DISASTER;
- health por capability;
- performance/efficiency/stability/trend;
- resilience/exposure/dependency/capacity/control;
- health horizon + early warning;
- leading + lagging indicators;
- local/global health;
- health heterogeneity;
- growth masking + subsidized health + hidden deterioration;
- health/maturity/risk/trajectory;
- acute/chronic/health debt;
- business health layers;
- capability health card + matrix + narrative;
- continuous state + digital twin + stateful consulting + health memory.

---

## 7. Contenido excluido del RAG

No se embebe como conocimiento general:

- health concreto del tenant;
- targets concretos;
- thresholds propios;
- exposure real;
- current metrics;
- historical state específico;
- runtime state.

La evidencia dinámica pertenece a tenant/runtime/experience.

---

## 8. Fronteras arquitectónicas

### D4 vs D3

- D3 = maturity / capacidad estructural.
- D4 = health / funcionamiento actual.

### D4 vs D6–D9

- D4 = dónde está enfermo.
- D6–D9 = por qué.

### D4 vs F4

- D4 = gravedad funcional.
- F4 = prioridad.

### D4 vs opportunity

- HEALTHY no significa optimizado.
- La oportunidad de mejora no convierte una capability en BAD.

---

## 9. Posibles solapamientos

Puede solaparse con:

- D1 Data Health;
- D2 Context;
- D3 Maturity;
- D5 Signals & Anomalies;
- D6–D9 causalidad/root cause;
- F4 Prioritization;
- F6 benchmarks/guardrails;
- F9 learning;
- monitoring/observability;
- executive health dashboard.

La clasificación mantiene cada responsabilidad separada.

---

## 10. Irregularidades del documento

La numeración interna contiene numerosos saltos:

- 12 → 18;
- 82 → 88;
- 105 → 110;
- 111 → 113;
- 116 → 120;
- 125 → 127;
- 128 → 131;
- 135 → 140;
- 148 → 154;
- 165 → 170;
- 184 → 186;
- 186 → 195;
- 195 → 206;
- 206 → 213;
- 217 → 221;
- 221 → 226;
- 237 → 258;
- 258 → 270;
- 283 → 286.

No se ha reconstruido contenido ausente.

---

## 11. Pérdida de información

No se detecta pérdida relevante.

El original se conserva íntegro en `00-corpus-maestro`.

Los ejemplos han sido condensados únicamente cuando ilustraban reglas ya preservadas.

---

## 12. Decisiones arquitectónicas

1. D4 debe ser una capa central de RAG.
2. Health state requiere contrato conceptual.
3. Evaluación continua pertenece a runtime.
4. Separaciones como Health ≠ Priority deben ser guardrails.
5. Health memory y baseline learning justifican experience-learning.
6. Targets, exposure y criticality concretos pertenecen a tenant-context.
7. D4 no debe cerrar causa raíz ni prioridad.
8. El heatmap es presentación, no razonamiento.
9. No se inventan schemas, weights ni thresholds ausentes.
