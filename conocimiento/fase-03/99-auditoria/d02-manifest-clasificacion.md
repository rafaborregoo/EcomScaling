# Fase 03 · D02 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D02-contextualizacion.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D2 — Contextualización

**Propósito declarado:** establecer el marco correcto antes de interpretar una señal, métrica o cambio del ecommerce.

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d02-contextualizacion.md` | Copia exacta del documento original. |
| `01-rag-produccion` | `d02-contextualizacion.md` | Conocimiento experto estable sobre interpretación contextual. |
| `02-contratos-IA` | `d02-requisitos-contrato-contextualizacion.md` | Requisitos conceptuales de información entre componentes. |
| `03-runtime` | `d02-flujo-contextualizacion.md` | Secuencia operacional de D2. |
| `04-policies-guardrails` | `d02-guardrails-contextualizacion.md` | Límites que no deben depender solo del RAG. |
| `05-experience-learning` | `d02-experiencia-historica-y-aprendizaje-contextual.md` | Historial de diagnósticos, experimentos, decisiones y snapshots contextuales. |
| `06-tenant-context` | `d02-contexto-configurable-ecommerce.md` | Información específica/configurable de cada ecommerce. |
| `99-auditoria` | `d02-manifest-clasificacion.md` | Trazabilidad completa. |

---

## 3. Capas con contenido real

### RAG

Muy abundante. Incluye:

- business model;
- purchase cycle;
- product economics;
- mix effects;
- temporal comparability;
- seasonality;
- promotions;
- change events;
- strategy;
- maturity;
- dependency;
- constraints;
- confounders;
- regime change;
- baselines;
- benchmarks;
- trade-offs;
- measurement discontinuity;
- Simpson's paradox;
- demand/capacity context;
- customer quality;
- profitability layers.

### Contratos

El documento define información que los componentes deben poder compartir, pero no schemas implementados.

### Runtime

Existe una secuencia operacional clara de contextualización antes de causalidad.

### Policies / Guardrails

Existen numerosas restricciones interpretativas que deben aplicarse siempre.

### Experience / Learning

Sí existe contenido real.

Las secciones sobre:

- contexto de aprendizaje previo;
- diagnósticos anteriores;
- experimentos;
- decisiones pasadas;
- context snapshot;

justifican un artefacto específico.

No se ha inventado un sistema de knowledge promotion, decay o aprendizaje cross-tenant porque la fuente no lo define.

### Tenant Context

El documento separa explícitamente conocimiento general de contexto concreto del tenant.

---

## 4. Conceptos clasificados en más de una capa

### Mix shift

- RAG: patrón experto.
- Contrato: información de segmentos y pesos.
- Runtime: comprobación operacional.
- Guardrail: no atribuir agregados a rendimiento interno sin segmentar.
- Tenant: composición concreta del ecommerce.

### Baseline

- RAG: jerarquía conceptual de comparación.
- Contrato: información mínima de baseline.
- Runtime: selección de referencia.
- Tenant: históricos y periodos propios.
- Experience: snapshots y experiencias previas.

### Change event

- RAG: principio general.
- Contrato: requisitos de representación.
- Runtime: revisión de cambios recientes.
- Tenant: cambios concretos.
- Experience: decisiones pasadas y efectos posteriores.

### Strategy / objectives

- RAG: trade-offs y business optimum.
- Contrato: requisitos de intercambio.
- Runtime: evaluación contextual.
- Tenant: objetivo y estrategia concretos.
- Experience: decisiones históricas bajo objetivos concretos.

### Measurement discontinuity

- RAG: patrón general.
- Contrato: requisito de informar cambios.
- Runtime: limitación de comparabilidad.
- Guardrail: no tratar series como homogéneas.
- Tenant: measurement state concreto.

### Declared vs observed context

- RAG: distinción conceptual.
- Contrato: representación separada.
- Runtime: reconciliación contextual.
- Guardrail: no resolver contradicciones silenciosamente.
- Tenant: fuentes concretas.

---

## 5. Contenido repetitivo consolidado

Se consolidaron:

- modelo de negocio + purchase cycle + ticket;
- product/customer/channel mix;
- temporal context + comparability + seasonality;
- promotions + promotional lift + pull-forward;
- internal changes + change events + lag;
- strategy + premium/promotional + trade-offs;
- growth velocity + maturity;
- dependency + concentration;
- constraints;
- confounders + simultaneous changes;
- regime change;
- own baseline + comparable period + benchmarks;
- objectives + local optimum;
- measurement context + discontinuity;
- context completeness + unknown context;
- segmentation + Simpson's paradox;
- demand + competition + platform + macro;
- availability + capacity;
- profitability layers + financial feasibility.

Los ejemplos se conservaron como patrones de interpretación en lugar de repetirse íntegramente.

---

## 6. Contenido excluido del RAG y motivo

### Contexto concreto del tenant

No debe embebirse como conocimiento universal:

- channel mix real;
- mercados reales;
- objetivos concretos;
- restricciones concretas;
- promotion state real;
- stock actual;
- change events específicos;
- measurement state actual.

### Historial de experiencias

Diagnósticos previos, experimentos y decisiones pasadas son memoria operacional, no conocimiento experto estático.

### Runtime

La secuencia de pasos de contextualización no pertenece al embedding.

### Guardrails

Las prohibiciones críticas deben aplicarse por política y no depender de retrieval.

---

## 7. Experience-learning: decisión específica

A diferencia de D01, D02 sí justifica `05-experience-learning`.

Motivos:

1. el documento declara que diagnósticos anteriores, experimentos y decisiones pasadas forman parte del contexto;
2. exige conservar un `context snapshot` histórico;
3. reconoce que el contexto cambia con el tiempo;
4. utiliza decisiones previas para interpretar correctamente cambios posteriores.

No se ha añadido:

- knowledge promotion;
- decay;
- cross-tenant learning;
- reinforcement;
- calibration automática;

porque no aparecen definidos.

---

## 8. Posibles solapamientos

Probables solapamientos futuros con:

- D1 calidad de datos;
- D3 o bloques posteriores de hipótesis/priorización;
- grafo causal;
- root cause;
- motor de memoria/experience;
- contratos de context snapshot;
- tenant profile;
- benchmark service.

La frontera principal es:

- D2 contextualiza;
- capas posteriores investigan causalidad.

---

## 9. Pérdida de información

No se detecta pérdida relevante.

Toda la inteligencia útil queda:

- preservada en corpus maestro;
- condensada en RAG;
- trasladada a su capa arquitectónica correcta.

---

## 10. Decisiones de arquitectura

1. D2 debe ser una capa fuerte de RAG porque contiene conocimiento experto reusable.
2. El contexto concreto de cada ecommerce debe vivir en tenant-context.
3. La secuencia de contextualización pertenece a runtime.
4. Los límites interpretativos deben existir en policies.
5. El historial de diagnósticos y decisiones pertenece a experience-learning.
6. D2 no debe cerrar causalidad.
7. No se inventa ningún schema técnico no definido por la fuente.
