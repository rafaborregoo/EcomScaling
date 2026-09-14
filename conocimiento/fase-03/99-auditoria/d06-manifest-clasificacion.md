# Fase 03 · D06 — Manifest de clasificación

## 1. Documento fuente

**Fuente:** `D06-motor-de-sintomas.md`

**Identidad interna:**

- Fase 3 — Sistema de Diagnóstico
- D6 — Motor de Síntomas

---

## 2. Archivos generados

| Capa | Archivo | Motivo |
|---|---|---|
| `00-corpus-maestro` | `d06-motor-de-sintomas.md` | Copia exacta del original. |
| `01-rag-produccion` | `d06-motor-de-sintomas.md` | Framework reusable de symptoms y pattern rules. |
| `02-contratos-IA` | `d06-requisitos-contrato-sintomas.md` | Requisitos conceptuales de Symptom Object, graph, scope y evidence. |
| `03-runtime` | `d06-flujo-motor-sintomas.md` | Pipeline Signal Cluster → Business Pattern → Symptom. |
| `04-policies-guardrails` | `d06-guardrails-sintomas.md` | Límites de causalidad, granularidad, contexto y acciones. |
| `05-experience-learning` | `d06-memoria-diagnostica-sintomas.md` | Diagnostic memory, recurring/chronic/positive patterns. |
| `06-tenant-context` | `d06-contexto-motor-sintomas.md` | Scope, funnel, business model y context específico del ecommerce. |
| `99-auditoria` | `d06-manifest-clasificacion.md` | Auditoría completa de clasificación. |

---

## 3. Capa principal

D06 es fuerte en `01-rag-produccion` y `03-runtime`.

El RAG contiene:

- signal-to-symptom principles;
- symptom families;
- common symptom combinations;
- pattern coherence;
- symptom granularity;
- parent-child structures;
- decomposition/composition;
- diagnostic depth;
- positive/mixed symptoms;
- time roles;
- abstracted business relationships.

Runtime contiene el proceso que decide cuándo un cluster puede convertirse en symptom.

---

## 4. Experience-learning

Sí existe contenido real.

La fuente incluye explícitamente:

- recurring symptoms;
- chronic/acute distinction;
- positive symptoms para F9;
- diagnostic memory;
- historical pattern recall;
- symptom sequence candidates.

No se inventa causal learning ni cross-tenant promotion.

---

## 5. Conceptos multi-capa

### Pattern coherence

- RAG: principio.
- Contrato: datos necesarios.
- Runtime: validación.
- Guardrail: no agrupar por simple simultaneidad.

### Symptom scope

- RAG: granularidad.
- Contrato: scope.
- Runtime: localization.
- Tenant: jerarquía concreta.

### Symptom relations

- RAG: may_precede/may_follow/often_cooccurs.
- Contrato: relation representation.
- Runtime: graph no causal.
- Experience: secuencia histórica.
- Guardrail: no confundir con causalidad.

### Diagnostic memory

- RAG: concepto.
- Runtime: consulta.
- Experience: almacenamiento histórico.
- Tenant: comparabilidad contextual.

### Positive symptoms

- RAG: conocimiento.
- Runtime: detección.
- Experience: aprendizaje de mejoras.
- Guardrail: no convertir mejora en causa.

---

## 6. Contenido consolidado

Se consolidaron:

- Observation → Signal → Symptom → Hypothesis → Cause;
- pattern coherence;
- symptom families por capability;
- acquisition/creative/conversion/offer/product/retention/inventory/operations/finance/data/technology/team/strategy;
- cross-capability symptoms;
- scope/granularity;
- parent-child/hierarchical symptoms;
- surface/intermediate/deep;
- decomposition/composition;
- positive/mixed symptoms;
- recurring/chronic/acute;
- qualitative/multimodal symptoms;
- leading/coincident/lagging;
- diagnostic refinement;
- relation with D1–D9.

---

## 7. Contenido excluido del RAG

No se embebe como verdad general:

- active symptoms concretos;
- tenant-specific symptom history;
- current scope values;
- current diagnostic case;
- current signal clusters;
- business-specific evidence;
- runtime graph state.

---

## 8. Fronteras arquitectónicas

### D5 vs D6

- D5 = señales.
- D6 = patrones sintomáticos.

### D6 vs D7

- D6 registra relaciones candidatas.
- D7 formaliza causal graph.

### D6 vs D8

- D6 no explica.
- D8 genera hypotheses.

### D6 vs D9

- D6 puede llegar a deep symptom.
- D9 busca root cause/constraint.

### D6 vs D4

- D4 = health state.
- D6 = patrón observable.

---

## 9. Irregularidades de numeración

El documento original presenta numerosos saltos, entre ellos:

- 2 → 4;
- 59 → 61;
- 65 → 90;
- 97 → 102;
- 114 → 141;
- 143 → 147;
- 149 → 156;
- 167 → 173;
- 173 → 175;
- 176 → 186;
- 186 → 200;
- 202 → 210;
- 210 → 218;
- 225 → 229;
- 231 → 255;
- 264 → 275;
- 279 → 281.

No se ha reconstruido contenido ausente.

---

## 10. Pérdida de información

No se detecta pérdida relevante.

El documento original se conserva completo en `00-corpus-maestro`.

Los ejemplos repetitivos se han transformado en patrones generales manteniendo su función diagnóstica.

---

## 11. Decisiones arquitectónicas

1. D6 requiere un RAG rico en pattern rules.
2. Symptom Object necesita contrato conceptual propio.
3. La construcción y refinamiento de symptoms pertenece a runtime.
4. `SYMPTOM ≠ CAUSE` debe ser guardrail duro.
5. Diagnostic memory y recurring patterns justifican experience-learning.
6. Scope, funnel y business model concretos pertenecen a tenant-context.
7. D6 no genera hipótesis ni acciones.
8. No se inventan schemas, scoring ni causal edges ausentes.
