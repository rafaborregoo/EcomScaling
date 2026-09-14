# Fase 04 · P01 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `P01-contexto-de-decision-y-objetivos.md`

**Identidad interna:**
- Fase 4 — Priorización y Decisión
- P1 — Contexto de Decisión y Objetivos

---

## 2. Naturaleza del documento

El documento se identifica explícitamente como:

`RAG / KNOWLEDGE`

A diferencia de P00, no contiene una Parte B contractual/runtime formal.

Por tanto:
- `01-rag-produccion` es la capa principal;
- `06-tenant-context` es especialmente importante;
- `02-contratos-IA` contiene solo requisitos conceptuales;
- `03-runtime` traduce procesos de razonamiento explícitos, sin inventar infraestructura.

---

## 3. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `p01-contexto-de-decision-y-objetivos.md` | Copia exacta del original. |
| `01-rag-produccion` | `p01-contexto-de-decision-y-objetivos.md` | Knowledge estable sobre objectives, context, guardrails, resources, maturity y risk. |
| `02-contratos-IA` | `p01-requisitos-contrato-contexto-decision.md` | Requisitos conceptuales; no schema inventado. |
| `03-runtime` | `p01-flujo-construccion-contexto-decision.md` | Proceso conceptual de construir/revisar decision context. |
| `04-policies-guardrails` | `p01-guardrails-contexto-objetivos.md` | Separaciones y anti-patterns de objective reasoning. |
| `05-experience-learning` | `p01-historial-contexto-y-objetivos.md` | Objective/context history y changes; sin learning algorithm. |
| `06-tenant-context` | `p01-contexto-decision-tenant.md` | Valores configurables/específicos por ecommerce. |
| `99-auditoria` | `p01-manifest-clasificacion.md` | Auditoría completa. |

---

## 4. RAG

El RAG contiene:
- objective-aware reasoning;
- objective taxonomy;
- primary vs secondary;
- goal vs metric/strategy/initiative/preference;
- declared vs revealed objective;
- conflict/trade-offs;
- objective hierarchy;
- survival/cash/profitability/growth/contribution/margin/retention/expansion/stability/scalability/efficiency/brand/learning;
- explore vs exploit;
- maturity fit;
- feasibility;
- resource constraints;
- capital allocation;
- marginal thinking;
- commitments;
- time horizon;
- guardrails;
- risk appetite vs capacity;
- continuity;
- concentration;
- objective portfolio;
- binding gap;
- must win/must not fail;
- context confidence;
- anti-patterns.

---

## 5. Contratos

No existe schema técnico en la fuente.

El contrato generado solo exige que futuros objetos puedan representar:
- objective context;
- provenance;
- conflicts;
- current reality;
- guardrails;
- constraints;
- resources;
- risk;
- commitments;
- horizons;
- must win/fail;
- concentrations;
- gap-to-objective;
- context confidence.

No se inventan:
- JSON;
- field IDs;
- DB tables;
- enums técnicos;
- APIs.

---

## 6. Runtime

P01 sí describe un proceso lógico inferible:
- identify objective;
- distinguish goal vs strategy/initiative;
- detect revealed objective;
- detect conflicts;
- establish hierarchy;
- evaluate survival;
- evaluate maturity/feasibility;
- incorporate constraints/resources/guardrails/risk/commitments/time;
- reframe bad objectives;
- assess confidence;
- maintain dynamic context.

No se define runtime técnico.

---

## 7. Guardrails

Se separan como policies:
- no objective blindness;
- no revenue universal objective;
- no growth/profit/cash simplistic rules;
- no local KPI optimization;
- no objective stacking;
- no target worship;
- no risk appetite > capacity assumption;
- no maturity ignorance;
- no sunk-cost priority;
- no objective changes without material evidence.

---

## 8. Experience-learning

Existe contenido histórico/dinámico, pero limitado:
- objective changes;
- triggered objective changes;
- strategic inertia;
- objective drift;
- context snapshots t1/t2;
- resource allocation history;
- commitment history;
- maturity-objective evolution.

No se define:
- auto learning;
- weight tuning;
- reinforcement;
- cross-tenant learning.

---

## 9. Tenant-context

P01 es especialmente fuerte aquí.

Deben vivir fuera del RAG global los valores concretos de:
- objectives;
- cash;
- unit economics;
- resources;
- risk capacity;
- guardrails;
- commitments;
- must win/fail;
- dependencies;
- event windows;
- concentrations;
- current/target state;
- context confidence.

---

## 10. Conceptos multi-capa

### Objective
- RAG: meaning.
- Contract: representability.
- Runtime: detection/reframing.
- Guardrail: no confusion with metric/strategy.
- Experience: history/change.
- Tenant: actual objective.

### Guardrail
- RAG: concept.
- Contract: requirement.
- Runtime: incorporate into context.
- Guardrail layer: cannot be violated by objective.
- Tenant: actual thresholds/rules.

### Risk Capacity
- RAG: appetite vs capacity.
- Contract: representability.
- Runtime: feasibility check.
- Tenant: actual capacity.

### Context Confidence
- RAG: principle.
- Contract: requirement.
- Runtime: assess missing/unclear context.
- Experience: historical clarity.
- Tenant: current confidence/gaps.

---

## 11. Fronteras

### P00 vs P01
- P00 defines the prioritization contract.
- P01 builds the decision context conceptually required by P00.

### P01 vs later ranking blocks
- P01 does not rank.
- It explains what the ranking must know.

### F3 vs P01
- F3 supplies maturity, constraints, diagnostics and health.
- P01 contextualizes them against business objectives/resources/risk/time.

---

## 12. Numeración

La numeración principal del documento es continua de 1 a 128.

No se detectan saltos estructurales equivalentes a los observados en varios documentos de Fase 3.

---

## 13. Pérdida de información

No se detecta pérdida relevante.

El corpus maestro conserva el original íntegro.

La reorganización elimina del RAG de producción únicamente:
- valores concretos de tenant que todavía no existen;
- historical runtime state;
- future implementation details no definidos.

---

## 14. Decisiones arquitectónicas

1. P01 debe conservarse principalmente como RAG.
2. `06-tenant-context` es una salida central, no secundaria.
3. No se inventa schema técnico porque la fuente no lo define.
4. Runtime se limita a proceso conceptual de construcción del contexto.
5. Objective history justifica una capa experience limitada.
6. Guardrails se extraen para evitar que el LLM convierta aspiraciones en prioridades ciegas.
7. P01 no calcula ranking, scoring ni playbooks.
