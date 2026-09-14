# Fase 03 · D07 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D07-grafo-causal-del-ecommerce.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D7 — Grafo Causal del Ecommerce

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d07-grafo-causal-del-ecommerce.md` | Copia exacta del original. |
| `01-rag-produccion` | `d07-grafo-causal-del-ecommerce.md` | Principios causales, mechanisms, chains, conditions y graph knowledge. |
| `02-contratos-IA` | `d07-requisitos-contrato-grafo-causal.md` | Requisitos de Node, Edge, Path, evidence y scoped graph. |
| `03-runtime` | `d07-flujo-razonamiento-causal.md` | Traversal, pruning, fit checks y path construction. |
| `04-policies-guardrails` | `d07-guardrails-causalidad.md` | Disciplina causal y anti-hallucination. |
| `05-experience-learning` | `d07-aprendizaje-causal-tenant.md` | Tenant learned edges, experiment evidence y evolution de confidence. |
| `06-tenant-context` | `d07-contexto-grafo-causal-ecommerce.md` | Scope, critical path, measurement architecture, exposure y constraints del tenant. |
| `99-auditoria` | `d07-manifest-clasificacion.md` | Auditoría completa. |

---

## 3. Capa principal

D07 es uno de los bloques más fuertes de RAG de la Fase 3.

El conocimiento reusable incluye:

- causal graph principles;
- node/edge taxonomy;
- mechanisms;
- conditions;
- expected sign;
- causal layers;
- metric causal graph;
- capability graphs;
- multicausality;
- mediators;
- confounders;
- counterfactual reasoning;
- evidence hierarchy;
- path traversal;
- measurement layer;
- graph anti-patterns.

---

## 4. Runtime

También existe contenido runtime muy fuerte:

- backward traversal;
- forward traversal;
- ancestor search;
- path pruning;
- temporal fit;
- lag fit;
- scope fit;
- magnitude fit;
- competing paths;
- case confidence;
- next evidence search.

---

## 5. Experience-learning

Sí existe contenido real.

Motivos:

- `Tenant Learned`;
- experiment edge update;
- natural experiments;
- internal evidence;
- learning from success;
- tenant-specific lags;
- historical evidence accumulation.

No se inventa automatic cross-tenant learning ni global graph mutation.

---

## 6. Conceptos multi-capa

### Causal Edge

- RAG: significado y tipos.
- Contrato: estructura.
- Runtime: aplicación/pruning.
- Guardrail: mechanism/evidence requirement.
- Experience: tenant-specific strengthening.

### Case Confidence

- RAG: edge prior vs case confidence.
- Contrato: representación.
- Runtime: evaluación.
- Guardrail: correlation-only no HIGH.
- Experience: evolución con evidencia histórica.

### Scope

- RAG: scoped nodes.
- Contrato: scope.
- Runtime: scope fit.
- Tenant: scopes concretos.

### Experiments

- RAG: evidence hierarchy.
- Contrato: evidence.
- Runtime: case evaluation.
- Experience: aprendizaje local.
- Tenant: experiment context.

### Measurement Layer

- RAG: real vs observed.
- Contrato: node type/layer.
- Runtime: measurement checks.
- Guardrail: no confundir tracking con negocio.
- Tenant: architecture concreta.

---

## 7. Contenido consolidado

Se consolidaron:

- node/edge principles;
- relation types;
- expected sign;
- conditions/mechanism;
- causal layers;
- graphs de acquisition/conversion/product/inventory/operations/finance/etc.;
- backward/forward traversal;
- edge strength/evidence;
- temporal/scope/magnitude fit;
- multicausality/interactions;
- mediators/confounders;
- counterfactual/control/experiment evidence;
- search/pruning;
- constraint graph;
- centrality/blast radius;
- scoped/template graph;
- event graph;
- measurement layer;
- competing paths;
- graph anti-patterns;
- capability causal maps.

---

## 8. Contenido excluido del RAG

No se embebe como conocimiento universal:

- current causal paths;
- case confidence concreto;
- tenant learned relation concreta;
- actual exposure;
- current node state;
- experiment result específico;
- runtime path status.

---

## 9. Fronteras arquitectónicas

### D6 vs D7

- D6 = qué patrón existe.
- D7 = qué mecanismos podrían producirlo.

### D7 vs D8

- D7 produce candidate causal branches.
- D8 genera hipótesis explícitas.

### D7 vs D9

- D7 puede buscar ancestors.
- D9 decide root cause / constraint.

### D7 vs D12

- D7 soporta confounders.
- D12 profundiza control de falsas interpretaciones causales.

### D7 vs F5

- Playbooks deben enlazarse con root causes validadas, no con surface metrics.

---

## 10. Irregularidades de numeración

El documento fuente tiene numerosos saltos, entre ellos:

- 3 → 5;
- 9 → 11;
- 10 omitido;
- 40 → 41;
- 123 → 125;
- 129 → 133;
- 135 → 137;
- 140 → 142;
- 176 → 177;
- 179 → 184;
- 185 → 195;
- 196 → 198;
- 200 → 202;
- 217 → 219;
- 224 → 226;
- 244 → 246;
- 253 → 257;
- 257 → 259;
- 263 → 278;
- 289 → 290;
- 324 → 326;
- 327 → 329;
- 329 → 340;
- 351 → 357;
- 358 → 360.

No se ha reconstruido contenido ausente.

---

## 11. Pérdida de información

No se detecta pérdida relevante.

El corpus maestro conserva el original completo.

Los ejemplos se han condensado en reglas y causal patterns sin eliminar las distinciones epistemológicas importantes.

---

## 12. Decisiones arquitectónicas

1. D7 requiere un RAG causal explícito.
2. Node/Edge/Path necesitan contrato conceptual.
3. Traversal y pruning pertenecen a runtime.
4. `PLAUSIBLE ≠ PROVEN` debe ser guardrail duro.
5. Tenant learned relations justifican experience-learning.
6. Scope, exposure, measurement architecture y constraints concretos pertenecen a tenant-context.
7. El grafo no debe mutar globalmente por correlaciones locales.
8. D7 no decide root cause.
9. No se inventan graph DB, schemas, weights ni algorithms ausentes.
