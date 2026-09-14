# Fase 04 · P05 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `P05-constraints-y-dependencias.md`

**Identidad interna:**
- Fase 4 — Priorización y Decisión
- P5 — Constraints y Dependencias

---

## 2. Naturaleza

La fuente se identifica como:

`RAG / KNOWLEDGE`

No define schemas técnicos formales.

Por tanto:
- `01-rag-produccion` es la capa principal;
- `02-contratos-IA` contiene requisitos conceptuales;
- `03-runtime` modela detection/validation/graph reasoning;
- `06-tenant-context` contiene el graph/capacities reales del ecommerce.

---

## 3. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `p05-constraints-y-dependencias.md` | Copia exacta. |
| `01-rag-produccion` | `p05-constraints-y-dependencias.md` | Knowledge estable sobre constraints, dependencies, flow y sequencing. |
| `02-contratos-IA` | `p05-requisitos-contrato-constraints-dependencias.md` | Requisitos conceptuales sin schema inventado. |
| `03-runtime` | `p05-flujo-constraints-dependencias.md` | Constraint detection, validation y dependency graph reasoning. |
| `04-policies-guardrails` | `p05-guardrails-constraints-dependencias.md` | Anti-patterns de bottleneck/dependency reasoning. |
| `05-experience-learning` | `p05-memoria-constraints-dependencias.md` | Constraint migration, removal tests, dependency failures y graph history. |
| `06-tenant-context` | `p05-contexto-constraints-dependencias-tenant.md` | Capacities, queues, resources, graph y dependencies reales. |
| `99-auditoria` | `p05-manifest-clasificacion.md` | Auditoría completa. |

---

## 4. RAG

Incluye:
- constraint definition;
- weakness/worst metric/maturity distinctions;
- objective dependence;
- binding tests;
- constraint types;
- current/emerging/future;
- migration;
- stack/shadow;
- constraint consumption;
- dependency/prerequisite/blocker;
- hard/soft/enabling;
- unlock value;
- critical path/slack;
- parallelism;
- upstream leverage;
- root vs intervention;
- dependency types/strength/certainty;
- minimum viable prerequisite;
- shared resource conflict;
- queues/pollution;
- centrality;
- single points;
- redundancy/substitution;
- common-mode failure;
- systemic loops;
- external dependency;
- risk/control;
- release value;
- subordination;
- flow clues;
- dependency debt;
- complexity/coordination;
- falsification;
- dynamic graph.

---

## 5. Contracts

No se inventa schema técnico.

Se recogen requisitos para representar:
- constraint object;
- role/status;
- tests/falsifier;
- stack/shadow;
- consumption;
- dependency edge;
- type/strength/certainty;
- blocker;
- critical path;
- slack;
- parallelism;
- redundancy;
- common-mode failures;
- dynamic graph.

---

## 6. Runtime

El reasoning flow incluye:
- define objective;
- map flow;
- detect saturation/queues/starvation;
- generate hypotheses;
- binding/counterfactual tests;
- falsifier;
- classify constraints;
- predict next constraint;
- map dependencies;
- hard/soft;
- alternatives;
- minimum prerequisite;
- redundancy;
- critical path;
- parallelism;
- shared resources;
- upstream leverage;
- loops;
- integrate urgency/impact;
- recalc dynamically.

---

## 7. Guardrails

Separaciones críticas:
- weakness ≠ constraint;
- dependency ≠ constraint;
- blocker ≠ priority;
- importance ≠ sequence;
- root cause ≠ first intervention;
- resource conflict ≠ causal dependency;
- centrality ≠ priority;
- current constraint ≠ permanent strategy.

También:
- no invented dependencies;
- no serial bias;
- no perfect prerequisites;
- no optimize non-constraints;
- no fake redundancy.

---

## 8. Experience-learning

Está claramente justificado por:
- constraint migration;
- next-constraint forecasting;
- removal tests;
- false positives/negatives;
- queue history;
- dependency failure;
- redundancy performance;
- blocker resolution;
- graph snapshots;
- recalculation events.

No se inventa automatic graph learning.

---

## 9. Tenant-context

P05 depende de:
- objective;
- capacities;
- saturation;
- queues;
- shared resources;
- decision rights;
- actual dependency graph;
- lead times;
- redundancy;
- external actors;
- control;
- policy constraints;
- complexity;
- forecast load.

Estos valores no pertenecen al RAG global.

---

## 10. Conceptos multi-capa

### Constraint
- RAG: meaning.
- Contract: representability.
- Runtime: detection/validation.
- Guardrail: not worst metric.
- Experience: migration/removal history.
- Tenant: actual bottleneck.

### Dependency
- RAG: meaning/types.
- Contract: edge properties.
- Runtime: graph construction.
- Guardrail: do not invent.
- Experience: changes/failures.
- Tenant: actual relations.

### Critical Path
- RAG: concept.
- Contract: nodes/slack.
- Runtime: sequencing.
- Guardrail: sequence ≠ importance.
- Experience: actual delay path.
- Tenant: current path.

### Redundancy
- RAG: resilience concept.
- Contract: alternatives/capacity.
- Runtime: effective redundancy check.
- Guardrail: theoretical ≠ effective.
- Experience: real activation.
- Tenant: actual backups.

---

## 11. Fronteras

### P01 vs P05
- P1 defines business objective/context.
- P5 identifies what constrains that objective.

### P03 vs P05
- P3 supplies time-to-damage/lead-time.
- P5 supplies structural position/dependencies.

### P04 vs P05
- P4 asks how much value is at stake.
- P5 asks whether that value can actually flow and what blocks/unlocks it.

### P05 vs F5
- P5 determines structure and sequence logic.
- F5 determines concrete intervention/playbook.

### D9 vs P05
- D9 identifies root cause/current constraint inside diagnosis.
- P5 places constraints and dependencies into the comparative decision portfolio and system graph.

---

## 12. Numeración

La numeración principal es continua de 1 a 306.

No se detectan saltos estructurales relevantes.

---

## 13. Pérdida de información

No se detecta pérdida relevante.

El corpus original queda preservado íntegramente.

Los numerosos ejemplos se han consolidado en principios, tests, anti-patterns y estructuras de reasoning reutilizables.

---

## 14. Decisiones arquitectónicas

1. P05 es principalmente RAG.
2. No se inventa graph schema ni database.
3. Constraint y dependency se mantienen estrictamente separados.
4. El runtime debe ser graph-aware, no solo list ranking.
5. Constraint hypotheses deben ser falsables.
6. `BUSINESS IMPORTANCE ≠ EXECUTION ORDER` se preserva como guardrail duro.
7. Experience-learning se justifica por migración y graph history.
8. Tenant-context es crítico porque capacities/dependencies son específicas.
9. P05 no selecciona playbook ni intervención final.
