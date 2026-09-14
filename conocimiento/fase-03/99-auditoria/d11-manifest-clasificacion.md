# Fase 03 · D11 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D11-confianza-e-incertidumbre.md`

**Identidad interna:**
- Fase 3 — Sistema de Diagnóstico
- D11 — Confianza e Incertidumbre

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d11-confianza-e-incertidumbre.md` | Copia exacta del original. |
| `01-rag-produccion` | `d11-confianza-e-incertidumbre.md` | Principios epistemológicos, confidence, uncertainty y evidence discipline. |
| `02-contratos-IA` | `d11-requisitos-contrato-confianza-incertidumbre.md` | Requisitos conceptuales de Claim Confidence, Uncertainty y Epistemic State. |
| `03-runtime` | `d11-flujo-evaluacion-confianza-incertidumbre.md` | Pipeline claim-by-claim de confidence, caps, decay y transparency. |
| `04-policies-guardrails` | `d11-guardrails-confianza-incertidumbre.md` | Anti-overconfidence, evidence discipline y language calibration. |
| `05-experience-learning` | `d11-calibracion-historica-confianza.md` | Confidence history, calibration, evidence value y uncertainty resolution. |
| `06-tenant-context` | `d11-contexto-confianza-incertidumbre.md` | Sources, coverage, horizons, complexity y gaps específicos del tenant. |
| `99-auditoria` | `d11-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

D11 es especialmente fuerte en:

- `01-rag-produccion`
- `02-contratos-IA`
- `04-policies-guardrails`

El conocimiento estable incluye:
- confidence levels;
- confidence dimensions;
- confidence caps;
- uncertainty types;
- epistemic states;
- evidence hierarchy;
- independence;
- contradictions;
- alternative separation;
- claim-specific confidence;
- confidence decay;
- uncertainty materiality;
- applicability confidence;
- retrieval vs diagnosis confidence;
- negative conclusions;
- confidence burden principle;
- transparency.

---

## 4. Experience-learning

Sí existe contenido real.

La fuente introduce:
- confidence changes over time;
- repeated tenant patterns;
- confidence decay;
- historical applicability;
- confidence improvement requirements;
- calibration implications.

El documento no define un algoritmo de aprendizaje, pero sí una memoria útil para F9.

No se inventa Bayesian updating ni automatic retraining.

---

## 5. Conceptos multi-capa

### Confidence

- RAG: definición/principios.
- Contrato: claim confidence object.
- Runtime: evaluación y actualización.
- Guardrail: evidence not linguistic certainty.
- Experience: calibration history.
- Tenant: coverage/reliability context.

### Uncertainty

- RAG: taxonomy/materiality.
- Contrato: uncertainty object.
- Runtime: classification/resolvability.
- Guardrail: transparency.
- Experience: resolution history.
- Tenant: known data gaps.

### Evidence

- RAG: hierarchy/independence.
- Contrato: evidence item.
- Runtime: evaluation.
- Guardrail: no double counting.
- Tenant: available sources.

### RAG Applicability

- RAG: applicability concept.
- Contrato: applicability metadata.
- Runtime: retrieval vs case separation.
- Guardrail: vector similarity ≠ truth.
- Tenant: source validity/version/context.

---

## 6. Contenido consolidado

Se consolidaron:
- HIGH/MEDIUM/LOW/INSUFFICIENT;
- data/context/sample/temporal/scope/mechanism dimensions;
- uncertainty taxonomy;
- known unknowns;
- epistemic states;
- evidence strength/independence;
- contradictions;
- alternatives;
- completeness vs confidence;
- claim target;
- confidence evolution/decay;
- materiality/resolvability;
- confidence matrix;
- language calibration;
- assumptions;
- deterministic vs interpretive claims;
- risk;
- RAG applicability;
- granularity/horizon;
- complexity;
- broad claim burden;
- external explanations;
- negative claims;
- invalidation confidence;
- confidence improvement;
- saturation;
- cost of error;
- known/likely/unknown;
- positive diagnosis.

---

## 7. Contenido excluido del RAG

No se embebe como conocimiento universal:
- current confidence values;
- current unknowns;
- current contradictions;
- tenant-specific reliability;
- historical confidence ledger;
- active diagnostic limitations;
- case-specific applicability.

---

## 8. Fronteras arquitectónicas

### D1 vs D11
- D1 = data quality/reliability.
- D11 = what that reliability permits us to claim.

### D8 vs D11
- D8 = compares hypotheses.
- D11 = formalizes confidence/separation/uncertainty.

### D9 vs D11
- D9 = root cause/constraint.
- D11 = confidence in each conclusion.

### D10 vs D11
- D10 = severity/impact.
- D11 = confidence in severity/impact estimates.

### RAG vs D11
- Retrieval similarity/authority ≠ case truth.
- D11 controls applicability and evidence burden.

---

## 9. Irregularidades de numeración

El documento original contiene numerosos saltos, entre ellos:

- 2 → 5;
- 8 → 10;
- 10 → 12;
- 23 → 25;
- 26 → 29;
- 30 → 33;
- 45 → 47;
- 53 → 55;
- 57 → 59;
- 69 → 72;
- 73 → 75;
- 80 → 82;
- 83 → 85;
- 86 → 90;
- 94 → 111;
- 114 → 117;
- 121 → 126;
- 131 → 133;
- 135 → 138;
- 141 → 144;
- 159 → 162;
- 166 → 172;
- 174 → 180;
- 196 → 202;
- 240 → 242;
- 245 → 252;
- 268 → 273;
- 288 → 297;
- 303 → 337;
- 340 → 343.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El original se conserva íntegramente en `00-corpus-maestro`.

Los ejemplos repetidos se han consolidado en:
- confidence principles;
- state distinctions;
- evidence rules;
- runtime checks;
- transparency requirements.

---

## 11. Decisiones arquitectónicas

1. D11 requiere RAG epistemológico explícito.
2. Claim Confidence y Uncertainty justifican contratos conceptuales propios.
3. Confidence evaluation/update/decay pertenece a runtime.
4. Anti-overconfidence y evidence discipline pertenecen a guardrails.
5. Confidence history/calibration justifican experience-learning.
6. Source map, coverage, horizons y gaps concretos pertenecen a tenant-context.
7. `VECTOR_SIMILARITY ≠ BUSINESS_TRUTH` se preserva como guardrail crítico.
8. No se inventan fórmulas numéricas, probabilidades ni Bayesian models ausentes.
