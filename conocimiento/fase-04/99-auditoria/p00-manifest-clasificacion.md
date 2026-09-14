# Fase 04 · P00 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `P00-contrato-de-priorizacion-y-decision.md`

**Identidad interna:**

- Fase 4 — Priorización y Decisión
- P0 — Contrato de Priorización y Decisión

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `p00-contrato-de-priorizacion-y-decision.md` | Copia exacta. |
| `01-rag-produccion` | `p00-priorizacion-y-decision.md` | Principios estables de prioridad y decisión comparativa. |
| `02-contratos-IA` | `p00-contratos-priorizacion-decision.md` | Objetos/enums explícitamente definidos por la fuente. |
| `03-runtime` | `p00-runtime-priorizacion-decision.md` | Arquitectura híbrida, gates, trace y flujo decisional. |
| `04-policies-guardrails` | `p00-guardrails-priorizacion-decision.md` | Invariantes obligatorias y límites F3/F4/F5. |
| `05-experience-learning` | `p00-historial-cambios-prioridad.md` | Priority changes y trace como inputs futuros para F9. |
| `06-tenant-context` | `p00-contexto-decision-tenant.md` | Objectives, constraints, resources, risk y guardrails del tenant. |
| `99-auditoria` | `p00-manifest-clasificacion.md` | Auditoría de clasificación. |

---

## 3. Particularidad arquitectónica

P00 mezcla deliberadamente dos grandes partes:

- `PARTE A — RAG / KNOWLEDGE`
- `PARTE B — IA CONTRACT / RUNTIME`

Por tanto, no debe guardarse entero como production RAG.

La Parte B contiene contratos y responsabilidades técnicas explícitas que deben vivir fuera de embeddings conceptuales.

---

## 4. RAG

Se conserva en RAG:

- definición de priority;
- priority vs severity/impact/urgency/constraint/confidence/effort;
- comparative reasoning;
- opportunity cost;
- management attention;
- validation as priority;
- preventive priority;
- protect vs unlock value;
- horizon;
- reversibility;
- time-to-damage;
- cost-of-delay;
- option value;
- critical path;
- dependencies;
- dominance;
- trade-offs;
- objective awareness;
- anti-patterns;
- root-level decision;
- dynamic priority.

No se incluyen allí schemas ni enums técnicos.

---

## 5. Contratos

P00 sí aporta estructuras contractuales reales:

- PRIORITIZATION_REQUEST
- diagnostic_candidates[]
- DECISION_CANDIDATE_TYPE
- DECISION_CONTEXT
- DECISION_HORIZON
- DECISION_RESULT
- DECISION_ITEM
- DECISION_CLASS
- PRIORITY_TIER
- DECISION_CONFIDENCE
- DECISION_TRACE
- EXCLUSION_REASON
- PRIORITIZATION_STATUS

No se han inventado estructuras fuera de la fuente.

---

## 6. Runtime

Se clasificó como runtime:

- hybrid decision model;
- validation gates;
- deterministic responsibilities;
- LLM responsibilities;
- LLM forbidden responsibilities;
- dedup safeguards;
- dependency handling;
- ranking stability;
- dynamic re-evaluation;
- trace creation;
- output validation;
- failure states.

---

## 7. Guardrails

P00 contiene una de las capas de guardrails más explícitas del corpus:

- no severity-only ranking;
- no impact-only ranking;
- no effort-first;
- no constraint auto-#1;
- no low-confidence discard;
- comparative explanation;
- traceability;
- evidence support;
- precision cap;
- objective awareness;
- survival guardrails;
- dependencies;
- root-level deduplication;
- phase boundary;
- ties;
- dynamic priority;
- priority invalidators.

---

## 8. Experience-learning

Existe contenido limitado pero real.

La fuente introduce:

- `PRIORITY_CHANGED`;
- previous/current rank;
- reason for change;
- ranking_changes[] en trace;
- comparison with previous ranking;
- explícita relevancia futura para F9.

No se inventa:
- learning of weights;
- outcome-based reinforcement;
- cross-tenant learning;
- auto-optimization.

---

## 9. Tenant context

Se clasifica como tenant-context:

- business objectives;
- protected outcomes;
- current constraints;
- resource context;
- risk context;
- maturity context;
- known commitments;
- hard guardrails;
- decision horizon;
- evidence availability;
- dependency context.

No se inventan valores concretos.

---

## 10. Conceptos multi-capa

### Decision Context

- RAG: prioridad contextual.
- Contrato: DECISION_CONTEXT.
- Runtime: construcción/consumo.
- Guardrail: no objective blindness.
- Tenant: valores reales.

### Decision Confidence

- RAG: distinction from diagnostic confidence.
- Contrato: enum.
- Runtime: evaluation.
- Guardrail: low confidence ≠ low priority.
- Experience: history of changes.

### Priority Change

- RAG: priority dynamic.
- Contrato: event semantics.
- Runtime: re-evaluation.
- Experience: historical record.
- Tenant: context that caused change.

### Dependencies

- RAG: precedence principle.
- Contrato: dependencies/blockers fields.
- Runtime: hard dependency pass.
- Guardrail: may override quantitative rank.
- Tenant: actual dependency graph.

---

## 11. Fronteras

### F3 → F4

F3 diagnoses.  
F4 prioritizes.

### F4 → F5

F4 decides where attention goes.  
F5 determines strategy/playbook.

Hard boundary:

`F4 MUST NOT GENERATE IMPLEMENTATION PLAYBOOKS`

---

## 12. Numeración

La numeración principal detectada es continua de 1 a 88.

No se detecta en P00 el patrón de saltos masivos observado en varios Dxx de Fase 3.

---

## 13. Pérdida de información

No se detecta pérdida relevante.

El original se conserva íntegro en `00-corpus-maestro`.

La separación ha eliminado del RAG de producción:

- schemas;
- enums técnicos;
- validation gates;
- deterministic responsibilities;
- observability structures;

pero estos contenidos se preservan íntegramente en sus capas correspondientes.

---

## 14. Decisiones arquitectónicas

1. P00 no debe tratarse como un único documento RAG.
2. La Parte A alimenta principalmente `01-rag-produccion`.
3. La Parte B alimenta principalmente `02-contratos-IA`, `03-runtime` y `04-policies-guardrails`.
4. Los objetos contractuales definidos por el propio documento se conservan literalmente a nivel conceptual.
5. El runtime debe ser híbrido, no `prompt → LLM → ranking`.
6. P00 establece contract/invariants, pero todavía no define `HOW TO RANK`.
7. `05-experience-learning` se limita a history/trace explícitamente soportados.
8. No se inventan scoring formulas, weights ni optimizer ausentes.
