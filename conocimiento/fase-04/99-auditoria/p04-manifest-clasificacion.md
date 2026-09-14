# Fase 04 · P04 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `P04-impacto-decisional-y-valor-en-juego.md`

**Identidad interna:**
- Fase 4 — Priorización y Decisión
- P4 — Impacto Decisional y Valor en Juego

---

## 2. Naturaleza

La fuente se identifica como:

`RAG / KNOWLEDGE`

No contiene schemas técnicos ni runtime formal.

Por tanto:
- `01-rag-produccion` es la capa principal;
- `02-contratos-IA` solo recoge requisitos conceptuales;
- `03-runtime` traduce el reasoning flow;
- `06-tenant-context` es central por economics y exposure específicos.

---

## 3. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `p04-impacto-decisional-y-valor-en-juego.md` | Copia exacta. |
| `01-rag-produccion` | `p04-impacto-decisional-y-valor-en-juego.md` | Knowledge estable sobre business value e impact. |
| `02-contratos-IA` | `p04-requisitos-contrato-impacto-decisional.md` | Requisitos conceptuales; sin schema inventado. |
| `03-runtime` | `p04-flujo-evaluacion-impacto-decisional.md` | Flujo de evaluación de value/exposure/incrementality. |
| `04-policies-guardrails` | `p04-guardrails-impacto-decisional.md` | Anti-patterns económicos y de atribución. |
| `05-experience-learning` | `p04-calibracion-historica-impacto.md` | Estimated vs realized impact, recapture, substitution y calibration. |
| `06-tenant-context` | `p04-contexto-impacto-tenant.md` | Economics, concentration, cash, CLV, inventory y exposure concretos. |
| `99-auditoria` | `p04-manifest-clasificacion.md` | Auditoría completa. |

---

## 4. RAG

Incluye:
- impact profile;
- realized/potential/recoverable/irrecoverable;
- revenue/gross profit/contribution/cash;
- CLV;
- baseline/counterfactual;
- exposure/value density;
- inventory/cash/customer impact;
- protect/recover/unlock;
- cannibalization/incrementality;
- direct/indirect effects;
- impact confidence;
- scenarios/tail risk;
- concentration/redundancy/substitution;
- brand/operations/strategic/enabling/learning/optionality/resilience;
- frequency/duration/compounding;
- attribution/overlap;
- constraint release;
- marginal value;
- capturable value;
- fragility;
- survival/continuity;
- impact amplifiers/dampeners.

---

## 5. Contracts

No existe schema técnico en la fuente.

Se preservan requisitos para representar:
- impact profile;
- value types;
- realized/potential/recoverable;
- baselines/counterfactuals;
- exposure;
- incrementality;
- opportunity;
- resilience/optionality;
- overlap;
- scenarios;
- confidence;
- assumptions.

---

## 6. Runtime

El flujo conceptual incluye:
- select value metric;
- current vs potential;
- baseline;
- counterfactual;
- exposure;
- value density;
- recoverability;
- substitution;
- cannibalization;
- cash;
- customer value;
- strategic/enabling value;
- overlap;
- attribution;
- constraint release;
- marginal value;
- scenarios;
- sensitivity;
- confidence.

---

## 7. Guardrails

Separaciones centrales:
- revenue ≠ value;
- exposure ≠ loss;
- gross ≠ incremental;
- attributed ≠ incremental;
- affected ≠ caused;
- TAM ≠ capturable;
- value exists ≠ value capturable;
- diagnosis confidence ≠ impact confidence.

También:
- no double counting;
- no fake precision;
- no magical brand valuation;
- no universal value metric.

---

## 8. Experience-learning

Sí está justificado por:
- estimate vs realized;
- baseline quality;
- recapture;
- substitution;
- cannibalization;
- actual incrementality;
- cohort economics;
- constraint release;
- marginal return;
- forecast/impact calibration;
- overlap audit.

No se inventa auto-training ni cross-tenant parameter sharing.

---

## 9. Tenant-context

P04 depende fuertemente de:
- unit economics;
- contribution;
- cash;
- CLV;
- category economics;
- inventory;
- concentration;
- redundancy;
- substitution;
- current constraints;
- risk capacity;
- business scale.

Estos valores concretos no deben estar en RAG global.

---

## 10. Conceptos multi-capa

### Impact
- RAG: definition.
- Contract: representability.
- Runtime: evaluation.
- Guardrail: no simplification.
- Experience: calibration.
- Tenant: actual values.

### Incrementality
- RAG: principle.
- Contract: gross vs incremental/cannibalization.
- Runtime: counterfactual.
- Guardrail: attribution ≠ incrementality.
- Experience: realized incrementality.
- Tenant: actual baselines.

### Exposure
- RAG: business exposure.
- Contract: dimensions.
- Runtime: computation.
- Guardrail: exposure ≠ loss.
- Tenant: shares/segments.

### Constraint Release
- RAG: concept.
- Contract: representability.
- Runtime: unlocked throughput.
- Experience: actual release outcomes.
- Tenant: current constraint/capacity.

---

## 11. Fronteras

### P03 vs P04
- P03 = cost of waiting/time sensitivity.
- P04 = amount and type of value at stake.

### P04 vs P06/P08
- P04 preserves value side.
- P6/P8 may later incorporate feasibility/effort in broader trade-offs.

### P04 vs D10
- D10 estimates business impact inside diagnosis.
- P04 reframes impact as a decision-comparison dimension across candidates and opportunities.

### P04 vs P00
- P00 requires `value_at_risk` and `value_to_unlock`.
- P04 supplies the conceptual machinery to assess them.

---

## 12. Numeración

La numeración principal es continua de 1 a 336.

No se detectan saltos estructurales relevantes.

---

## 13. Pérdida de información

No se detecta pérdida relevante.

El corpus original queda preservado íntegro.

Los numerosos ejemplos se consolidaron en principios y patrones reutilizables, preservando sus distinciones económicas y decisionales.

---

## 14. Decisiones arquitectónicas

1. P04 es principalmente RAG.
2. Contracts se limita a requisitos conceptuales.
3. Runtime no implementa accounting engine ni scoring.
4. Impact no se colapsa en revenue ni score único.
5. Tenant-context es central por economics específicos.
6. Experience-learning se limita a calibración histórica soportada.
7. No se monetiza artificialmente strategic/brand/learning value.
8. No se inventan probability models ni ranking formulas.
