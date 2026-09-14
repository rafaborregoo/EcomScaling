# Fase 03 · D07 — Requisitos contractuales del grafo causal

## Estado

La fuente define un contrato conceptual muy rico para nodos, edges, paths y evidencia causal, pero no implementa schema técnico final.

No se inventan JSON Schema, tablas, APIs ni tipos definitivos.

---

## 1. Causal Node

Un nodo debería poder representar:

- canonical concept;
- node type;
- domain/capability;
- scope;
- observability;
- state/value reference;
- business layer;
- provenance.

Tipos conceptuales:

- metric;
- state;
- event;
- contextual;
- structural;
- outcome.

---

## 2. Node Observability

Debe poder distinguir:

- `DIRECTLY_OBSERVED`
- `DERIVED`
- `LATENT`
- `EXTERNAL`

---

## 3. Causal Edge

Un edge debería poder representar:

- from node;
- to node;
- relation type;
- direction;
- expected sign;
- mechanism;
- conditions;
- expected lag;
- strength;
- evidence level;
- scope constraints;
- non-linearity;
- threshold/saturation behavior.

---

## 4. Relation Types

Debe poder distinguir:

- `MATHEMATICAL`
- `MECHANISTIC`
- `BEHAVIORAL`
- `ECONOMIC`
- `OPERATIONAL`
- `TECHNICAL`
- `STRUCTURAL`
- `TEMPORAL`
- `CONTEXTUAL`
- `LIMITS`
- `REQUIRES`
- `INTERACTION`

---

## 5. Expected Sign

Debe poder representar:

- `POSITIVE`
- `NEGATIVE`
- `NON_MONOTONIC`
- `CONTEXT_DEPENDENT`

---

## 6. Conditions

Un edge puede requerir condiciones explícitas.

Ejemplo conceptual:

- CPM → CPC positivo si CTR permanece aproximadamente constante.

---

## 7. Mechanism

Todo edge causal global debe poder describir:

- mechanism;
- diagnostic rationale.

Sin mecanismo, una correlación no debe convertirse en edge causal validado.

---

## 8. Edge Strength

Valores conceptuales:

- `STRONG`
- `MODERATE`
- `WEAK`
- `CONTEXT_DEPENDENT`

---

## 9. Edge Evidence Level

Niveles conceptuales:

- `DETERMINISTIC`
- `STRONGLY_ESTABLISHED`
- `COMMON_MECHANISM`
- `PLAUSIBLE`
- `SPECULATIVE`

---

## 10. Knowledge Source

Debe poder distinguir:

- System Logic
- Internal Evidence
- External Knowledge
- Expert Heuristic
- Tenant Learned

---

## 11. Edge Prior vs Case Confidence

Debe mantenerse separado:

- global edge prior;
- case causal confidence.

---

## 12. Causal Path

Una ruta debería poder expresar:

- target;
- ordered nodes;
- ordered edges;
- support;
- contradictions;
- missing evidence;
- path confidence;
- status.

Posibles status:

- supported;
- contradicted;
- untested;
- partial.

---

## 13. Temporal Fit

Debe poder evaluarse:

- cause onset;
- effect onset;
- temporal precedence;
- expected lag;
- observed lag;
- fit.

---

## 14. Scope Fit

Debe poder comparar:

- cause scope;
- effect scope;
- overlap;
- compatibility.

---

## 15. Magnitude Fit

Debe poder registrar si una causa candidata tiene suficiente exposición/magnitud para explicar el efecto.

---

## 16. Causal Contribution

Cuando sea posible debe poder estimarse:

- partial contribution;
- possible contribution to observed change.

No se define fórmula universal.

---

## 17. Cause Role

Debe poder representar:

- `NECESSARY`
- `SUFFICIENT`
- `CONTRIBUTORY`

según contexto/evidencia.

---

## 18. Multiple Causes

Una explicación puede contener múltiples causes parciales.

El contrato debe permitir multicausalidad.

---

## 19. Interaction / Hyperedge

Debe poder representar conceptualmente:

`A + B → C`

cuando una causa combinada sea necesaria.

---

## 20. Mediators

Una path debe poder identificar mediators.

---

## 21. Confounders

Debe poder identificar candidate confounders y mantenerlos separados de causal edges confirmados.

---

## 22. Candidate Relation

Una correlación puede generar:

- `UNVALIDATED_RELATION`

hasta disponer de mecanismo/evidencia.

---

## 23. Counterfactual Evidence

Debe poder asociarse evidencia procedente de:

- unaffected segments;
- control markets;
- other devices;
- previous period;
- natural experiments;
- randomized experiments.

---

## 24. Evidence Hierarchy

Debe poder reflejar:

1. RANDOMIZED_EXPERIMENT
2. NATURAL_EXPERIMENT
3. BEFORE_AFTER_WITH_CONTROL
4. TEMPORAL + MECHANISTIC
5. MULTI_SOURCE_CORROBORATION
6. CORRELATION_ONLY

---

## 25. Causal Search Result

Ante un target, D7 debería poder devolver:

- candidate parents;
- candidate ancestors;
- supported paths;
- contradicted paths;
- missing evidence;
- next nodes to investigate.

---

## 26. Path Pruning

Debe poder marcar una branch como:

- gaining support;
- losing support;
- contradicted;
- still untested.

---

## 27. Constraint Relations

Debe soportar:

- `LIMITS`
- `REQUIRES`

además de influence edges.

---

## 28. Centrality y Critical Path Metadata

Puede conservar:

- degree;
- betweenness;
- critical path role;
- blast radius.

No debe equivaler a prioridad.

---

## 29. Scoped Graph

Debe soportar instancias como:

- `CVR[Spain][Mobile]`
- SKU-specific availability;
- channel-specific metrics.

---

## 30. Graph Inheritance

Debe poder instanciar relaciones generales por scope cuando sea válido.

---

## 31. Measurement Layer

Debe diferenciar:

- real-world variable;
- measurement system;
- observed metric.

---

## 32. Loop Metadata

Conceptualmente puede representar:

- reinforcing loop;
- balancing loop;
- feedback loop.

---

## 33. Tenant Learned Edge

Debe poder diferenciar una relación aprendida para un tenant de un edge global.

---

## 34. Elementos no definidos

No están definidos:

- JSON Schema;
- DB schema;
- graph DB;
- vector representation;
- traversal implementation;
- confidence formula;
- exact edge weights;
- exact update rule;
- APIs;
- persistence.
