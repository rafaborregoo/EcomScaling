# Fase 03 · D08 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D08-generador-y-contraste-de-hipotesis.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D8 — Generador y Contraste de Hipótesis

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d08-generador-y-contraste-de-hipotesis.md` | Copia exacta del original. |
| `01-rag-produccion` | `d08-generador-y-contraste-de-hipotesis.md` | Framework experto de hypothesis generation/testing/falsification. |
| `02-contratos-IA` | `d08-requisitos-contrato-hipotesis.md` | Requisitos conceptuales de Hypothesis Object, Evidence Ledger, tests y confidence. |
| `03-runtime` | `d08-flujo-generacion-y-contraste-hipotesis.md` | Pipeline Generate → Test → Compare → Falsify → Update. |
| `04-policies-guardrails` | `d08-guardrails-hipotesis.md` | Confirmation bias, certainty, evidence independence, action boundaries. |
| `05-experience-learning` | `d08-historial-y-calibracion-de-hipotesis.md` | Hypothesis ledger, tenant priors, agent calibration y historical performance. |
| `06-tenant-context` | `d08-contexto-motor-hipotesis.md` | Priors, events, tools, experiments, scope y business criticality del tenant. |
| `99-auditoria` | `d08-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

D08 es fuerte en:

- `01-rag-produccion`
- `03-runtime`
- `05-experience-learning`

RAG contiene:

- hypothesis principles;
- multiple hypotheses;
- priors;
- support/contradiction/missing evidence;
- falsification;
- information gain;
- challenger hypothesis;
- confidence;
- coverage;
- multicausality;
- diagnostic uncertainty;
- root candidate depth;
- explainability.

Runtime contiene el proceso de investigación.

Experience contiene el histórico de aciertos, errores, calibración y priors específicos.

---

## 4. Experience-learning

Está claramente justificado.

La fuente introduce:

- hypothesis ledger;
- rejected hypotheses retention;
- historical hypothesis performance;
- agent calibration;
- confirmation/false-positive/invalidation rates;
- recurring hypothesis;
- tenant-specific priors;
- knowledge feedback.

No se inventa cross-tenant learning ni promotion automática.

---

## 5. Conceptos multi-capa

### Hypothesis status

- RAG: meaning.
- Contrato: representation.
- Runtime: state updates.
- Experience: historical transitions.
- Guardrail: confirmed debe ser raro.

### Prior

- RAG: prior plausibility.
- Runtime: initial weighting.
- Experience: tenant-specific priors.
- Tenant: historical relevance.
- Guardrail: prior ≠ conclusion.

### Evidence

- RAG: support/against/missing/discriminating.
- Contrato: ledger.
- Runtime: collection and testing.
- Guardrail: independence/conflict.
- Tenant: available sources.

### Tests

- RAG: falsifiability/information gain.
- Contrato: test object.
- Runtime: next-best-test.
- Tenant: tooling/experiment capabilities.
- Guardrail: diagnostic action ≠ business action.

### Confidence

- RAG: categories and language.
- Contrato: field.
- Runtime: update.
- Experience: calibration.
- Guardrail: no certainty theater.

---

## 6. Contenido consolidado

Se consolidaron:

- hypothesis generation;
- candidate count;
- priors;
- evidence for/against/missing;
- discriminating evidence;
- falsifiability;
- parsimony;
- explanatory power;
- fit dimensions;
- status/ledger;
- comparative matrix;
- primary/secondary/challenger;
- canonical codes;
- families by capability;
- next-best-test;
- evidence independence;
- contradiction classes;
- multi-step hypotheses;
- confidence;
- multi-agent;
- recursive diagnosis;
- acute/structural;
- residual/coverage;
- uncertainty;
- historical priors;
- explainability;
- merge/split/versioning.

---

## 7. Contenido excluido del RAG

No se embebe como conocimiento general:

- active hypotheses;
- current evidence ledger;
- current confidence;
- tenant-specific priors;
- case-specific statements;
- test outcomes;
- agent performance metrics;
- runtime status.

---

## 8. Fronteras arquitectónicas

### D7 vs D8

- D7 = causal branches.
- D8 = explicit competing explanations.

### D8 vs D9

- D8 = best supported hypothesis/root candidate.
- D9 = formal root cause + constraint.

### D8 vs business action

- D8 puede proponer diagnostic tests.
- D8 no prescribe business actions.

### D8 vs D11

- D11 profundizará confidence/uncertainty.

### D8 vs D12

- D12 profundizará confounders/false diagnosis.

### D8 vs F9

- F9 aprende del historical hypothesis dataset.

---

## 9. Irregularidades de numeración

El documento contiene numerosos saltos, entre ellos:

- 2 → 4;
- 4 → 7;
- 31 → 34;
- 38 → 40;
- 57 → 59;
- 59 → 62;
- 62 → 65;
- 79 → 80;
- 103 → 105;
- 107 → 111;
- 139 → 141;
- 145 → 150;
- 156 → 160;
- 167 → 168;
- 172 → 174;
- 174 → 180;
- 182 → 188;
- 190 → 191;
- 191 → 196;
- 228 → 229;
- 233 → 235;
- 244 → 247;
- 253 → 255;
- 262 → 268;
- 285 → 286;
- 286 → 289;
- 302 → 314;
- 315 → 319;
- 320 → 322;
- 331 → 333;
- 344 → 346;
- 347 → 349.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El corpus maestro conserva íntegro el documento original.

Los ejemplos se han condensado en patrones y fixtures conceptuales manteniendo sus distinciones diagnósticas.

---

## 11. Decisiones arquitectónicas

1. D8 necesita RAG fuerte de diagnostic reasoning.
2. Hypothesis/Evidence/Test necesitan contrato conceptual.
3. Generate-Test-Compare-Falsify-Update pertenece a runtime.
4. Anti-confirmation-bias debe vivir en guardrails.
5. Hypothesis history y agent calibration justifican experience-learning.
6. Tooling, events y tenant priors pertenecen a tenant-context.
7. D8 no debe cerrar root cause ni constraint.
8. No se inventan scoring formulas, schemas ni protocols ausentes.
