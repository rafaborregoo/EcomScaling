# Fase 03 · D09 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D09-root-cause-constraint-engine.md`

**Identidad interna:**
- Fase 3 — Sistema de Diagnóstico
- D9 — Root Cause & Constraint Engine

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d09-root-cause-constraint-engine.md` | Copia exacta del original. |
| `01-rag-produccion` | `d09-root-cause-constraint-engine.md` | Framework experto de root cause, depth y constraints. |
| `02-contratos-IA` | `d09-requisitos-contrato-root-cause-constraint.md` | Requisitos conceptuales de Root Cause Object y Constraint Object. |
| `03-runtime` | `d09-flujo-root-cause-constraint.md` | Pipeline de cierre causal y binding constraint detection. |
| `04-policies-guardrails` | `d09-guardrails-root-cause-constraint.md` | Límites de closure, causalidad, blame, scope y prioridad. |
| `05-experience-learning` | `d09-memoria-root-causes-y-constraints.md` | Recurrence, constraint migration, recovery y positive drivers. |
| `06-tenant-context` | `d09-contexto-root-cause-constraint.md` | Targets, capacities, guardrails y scopes específicos del tenant. |
| `99-auditoria` | `d09-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

D09 es fuerte en:

- `01-rag-produccion`
- `02-contratos-IA`
- `03-runtime`

El RAG contiene:
- root cause definition;
- immediate/intermediate/root/underlying distinctions;
- root depth;
- confidence;
- evidence hierarchy;
- root families/types;
- constraint definition;
- binding/latent/structural constraints;
- throughput thinking;
- counterfactual tests;
- constraint shift;
- positive drivers.

---

## 4. Experience-learning

Sí existe contenido real.

Motivos:
- recurring root causes;
- structural driver recurrence;
- constraint migration;
- constraint sequence;
- recovery patterns;
- positive driver learning.

No se inventa promoción automática cross-tenant.

---

## 5. Conceptos multi-capa

### Root Cause

- RAG: definición y depth.
- Contrato: object.
- Runtime: validation/closure.
- Guardrail: no premature closure.
- Experience: recurrence.
- Tenant: scope/context.

### Constraint

- RAG: binding concept.
- Contrato: object.
- Runtime: binding/counterfactual test.
- Guardrail: constraint ≠ priority.
- Experience: migration.
- Tenant: target/capacity.

### Confidence

- RAG: calibration.
- Contrato: field.
- Runtime: recalibration.
- Guardrail: confirmed rare.
- Experience: calibration history.

### Recurrence

- RAG: recurring/systemic cause concept.
- Runtime: recurrence check.
- Experience: history.
- Tenant: historical cases.

---

## 6. Contenido consolidado

Se consolidaron:
- symptom/immediate/root/driver distinction;
- root depth;
- partial/unresolved causes;
- constraint taxonomy;
- binding/latent constraints;
- throughput;
- target dependency;
- hard/soft constraints;
- maturity/constraint relationship;
- root cause families/types;
- evidence hierarchy;
- multicausality;
- recurrence/systemic causes;
- active/resolved states;
- intervention validation;
- root cause chains;
- causal language;
- canonical codes;
- constraint falsification;
- controllability/reversibility;
- serial/parallel/scoped constraints;
- demand-vs-capacity model;
- blame avoidance;
- positive drivers.

---

## 7. Contenido excluido del RAG

No se embebe como conocimiento universal:
- current root cause;
- current constraint;
- tenant-specific recurrence;
- actual confidence;
- actual exposure;
- active/resolved case state;
- current residual;
- current throughput figures.

---

## 8. Fronteras arquitectónicas

### D8 vs D9

- D8 = best supported hypotheses.
- D9 = root cause + current constraint.

### D9 vs D10

- D9 = cause/constraint.
- D10 = severity/impact.

### D9 vs F4

- D9 identifies constraint.
- F4 decides priority.

### D9 vs F9

- D9 stores diagnosis.
- F9 learns recurrence, migration and calibration.

---

## 9. Irregularidades del documento

La numeración presenta numerosos saltos, entre ellos:

- 5 → 9;
- 12 → 14;
- 20 → 22;
- 34 → 36;
- 39 → 41;
- 43 → 45;
- 52 → 54;
- 73 → 76;
- 85 → 92;
- 100 → 104;
- 109 → 113;
- 115 → 118;
- 126 → 128;
- 141 → 145;
- 145 → 147;
- 161 → 166;
- 167 → 169;
- 169 → 173;
- 179 → 186;
- 201 → 205;
- 238 → 243;
- 245 → 247;
- 252 → 287;
- 287 → 289;
- 291 → 293.

Además, existe una sección aislada con `1.` cerca del tramo previo a 287, sin contenido semántico útil asociado.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El original queda íntegramente preservado en `00-corpus-maestro`.

Los ejemplos se han condensado a reglas conceptuales manteniendo:
- roles causales;
- confidence;
- scope;
- constraint logic;
- distinctions.

---

## 11. Decisiones arquitectónicas

1. D9 necesita RAG explícito de root cause/constraint.
2. Root Cause Object y Constraint Object justifican contrato propio.
3. Validation + binding tests pertenecen a runtime.
4. `ROOT CAUSE ≠ CONSTRAINT ≠ PRIORITY` debe ser guardrail duro.
5. Recurrence y constraint migration justifican experience-learning.
6. Targets, capacities, economic guardrails y scopes concretos pertenecen a tenant-context.
7. D9 no calcula severity ni priority.
8. No se inventan schemas, scoring formulas ni APIs ausentes.
