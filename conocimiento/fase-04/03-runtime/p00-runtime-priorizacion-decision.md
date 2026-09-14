# Fase 04 · P00 — Runtime de priorización y decisión

## Propósito

El runtime transforma:

`DIAGNOSTIC PORTFOLIO + DECISION CONTEXT → DECISION QUEUE`

sin saltar a playbooks.

---

## 1. Arquitectura híbrida

Modelo conceptual:

`DETERMINISTIC RULES`
+
`NORMALIZED DECISION FACTORS`
+
`CONSTRAINT / DEPENDENCY LOGIC`
+
`LLM COMPARATIVE REASONING`
→
`DECISION RESULT`

No:

`PROMPT → LLM → PRIORITY LIST`

---

## 2. Validation Gates — Input

Antes de priorizar:

- INPUT_SCHEMA_VALID
- TENANT_VALID
- DIAGNOSTICS_PRESENT
- DECISION_CONTEXT_AVAILABLE
- EVIDENCE_REFERENCES_VALID
- NO_CRITICAL_CONTEXT_CONTRADICTION

Si falla un requisito material, el sistema debe poder devolver failure state.

---

## 3. Preparación de candidatos

1. Validar identidad.
2. Verificar tenant.
3. Validar refs diagnósticas.
4. Filtrar resolved/out-of-scope.
5. Detectar candidatos no materiales.
6. Identificar candidate type:
   - PROBLEM;
   - CONSTRAINT;
   - RISK;
   - OPPORTUNITY;
   - VALIDATION_NEED.
7. Aplicar salvaguardas de deduplicación causal.
8. Identificar blockers/dependencies.

---

## 4. Construcción de Decision Context

Consumir:

- objective context;
- protected outcomes;
- current constraints;
- resource context;
- risk context;
- maturity;
- commitments;
- hard guardrails;
- horizon;
- as_of.

Si falta objective context:

- declarar `OBJECTIVE_CONTEXT_MISSING`.

No asumir growth silenciosamente.

---

## 5. Emergency / Guardrail Pass

Antes de ranking ordinario, comprobar:

- survival;
- security;
- legal/compliance;
- financial integrity;
- business continuity;
- ability to transact;
- catastrophic financial exposure.

Los guardrails críticos pueden preemptar objetivos ordinarios.

---

## 6. Comparative Reasoning

Para cada candidato, considerar:

- value at risk;
- value to unlock;
- cost of delay;
- time to damage;
- time to irreversibility;
- forward damage;
- current damage;
- dependency position;
- critical path;
- current constraint;
- objective alignment;
- resource demand;
- reversibility;
- uncertainty;
- validation cost;
- opportunity cost.

---

## 7. Dominance Pass

Si A domina B claramente en dimensiones materiales:

- registrar dominance;
- evitar complejidad innecesaria.

---

## 8. Dependency Pass

Si B requiere A y A está unresolved:

- B puede quedar `BLOCKED`;
- A puede ganar precedencia;
- registrar hard dependency.

---

## 9. Root-level Deduplication

Antes del ranking final:

- shared root cause;
- shared constraint;
- dependent symptoms;

deben evitar duplicación artificial de importancia.

Implementación detallada se delega a bloques posteriores.

---

## 10. Validation-as-Decision Pass

Si existe:

- high potential value/risk;
- low diagnostic confidence;
- cheap/fast validation;

el candidato puede recibir:

- `VALIDATE_FIRST`.

No debe descartarse por low confidence.

---

## 11. Ranking / Classification

El motor puede producir:

- immediate attention;
- prioritize;
- validate first;
- schedule;
- monitor;
- defer;
- blocked;
- exclude.

Después asigna:

- relative rank;
- priority tier.

`rank` y `tier` no son equivalentes.

---

## 12. Tie Detection

Si A y B son materialmente equivalentes bajo la precisión disponible:

- marcar TIED/equivalent;
- no fabricar diferencias numéricas.

---

## 13. Ranking Stability

Probar sensibilidad razonable.

Si pequeños cambios plausibles producen grandes saltos:

- reducir decision confidence;
- emitir `RANKING_INSTABILITY`.

---

## 14. Decision Confidence

Debe diferenciarse de diagnostic confidence.

Factores conceptuales:

- comparison evidence;
- context completeness;
- objective clarity;
- dependency clarity;
- stability;
- uncertainty;
- guardrail state.

No se define fórmula exacta en P00.

---

## 15. Comparative Explanation

Todo candidato rankeado debe responder:

- `WHY_NOW`
- `WHY_BEFORE`

cuando existe competencia material.

También:

- primary drivers;
- counterarguments;
- uncertainty;
- what would change priority.

---

## 16. Decision Trace

Registrar:

- inputs;
- objectives;
- constraints;
- guardrails;
- factors;
- rules;
- overrides;
- ranking changes;
- exclusions;
- uncertainty;
- model/prompt/engine/rule versions.

---

## 17. Output Validation Gates

Después de priorizar:

- OUTPUT_SCHEMA_VALID
- ALL_RANKS_TRACEABLE
- NO_DUPLICATE_RANKS_INVALIDLY
- PHASE_BOUNDARY_RESPECTED
- NO_UNSUPPORTED_FACTS
- NO_UNEXPLAINED_OVERRIDE

---

## 18. Dynamic Re-evaluation

Todo resultado tiene:

- `as_of`
- `horizon`

Cuando cambia contexto:

1. re-evaluar;
2. comparar con ranking previo;
3. emitir `PRIORITY_CHANGED` si cambio material;
4. explicar reason.

---

## 19. Failure States

El runtime debe poder terminar como:

- SUCCESS
- PARTIAL
- NOT_ASSESSABLE
- INVALID_INPUT
- CONTEXT_INSUFFICIENT
- CONFLICTING_EVIDENCE
- ENGINE_ERROR

No fabricar una cola convincente ante contexto insuficiente.

---

## 20. Responsabilidades deterministas

Como mínimo:

- schema validation;
- tenant validation;
- ID integrity;
- enum validation;
- required fields;
- dedup safeguards;
- phase boundary;
- hard dependencies;
- guardrail enforcement;
- evidence ref integrity;
- version tracking;
- trace creation;
- confidence ceilings;
- output validation.

---

## 21. Responsabilidades del LLM

Puede participar en:

- trade-off interpretation;
- comparative reasoning;
- qualitative synthesis;
- rationale;
- counterarguments;
- uncertainty explanation;
- context interpretation;
- decision narrative.

Siempre sobre datos/reglas suministrados.

---

## 22. Responsabilidades prohibidas al LLM

No decide libremente:

- schema;
- tenant access;
- hard guardrails;
- confidence ceilings;
- financial calculations;
- candidate identity;
- rule versions;
- mandatory dependencies;
- evidence provenance.

---

## 23. Observabilidad

El runtime/admin debe poder responder:

- Why was A ranked above B?
- Which inputs caused the ranking?
- Which objective was active?
- Which constraint was active?
- Which dependency changed the order?
- Was any hard rule triggered?
- Was there an override?
- Which evidence supported impact?
- What was uncertain?
- Which model/prompt/engine version participated?
- What changed from previous ranking?

---

## 24. P00 Test Intent

P00 exige como mínimo comportamientos verificables para:

- severity inversion;
- low-confidence catastrophic candidate;
- dependency override;
- emergency preemption;
- effort bias;
- objective change;
- missing objective;
- duplicate causal chain;
- false precision;
- phase contamination;
- decision uncertainty;
- ranking tie;
- guardrail override;
- dynamic ranking.

---

## 25. Boundary

P00 todavía no resuelve exactamente:

`HOW TO RANK`

Eso se desarrolla en P1–P10.

P00 sí fija:

- inputs;
- outputs;
- states;
- invariants;
- traceability;
- deterministic vs LLM responsibilities.
