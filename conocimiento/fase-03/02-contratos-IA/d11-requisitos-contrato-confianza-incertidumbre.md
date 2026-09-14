# Fase 03 · D11 — Requisitos contractuales de confianza e incertidumbre

## Estado

La fuente define un contrato epistemológico muy fuerte, pero no un schema técnico implementado.

No se inventan JSON Schema, tablas, APIs ni fórmulas exactas.

---

## 1. Claim Confidence Object

Debería poder representar:

- claim;
- target/question;
- epistemic_state;
- confidence_level;
- confidence_reasons;
- confidence_caps;
- evidence_refs;
- contradictions;
- missing_evidence;
- assumptions;
- limitations;
- explanatory_coverage;
- applicability;
- freshness;
- updated_at.

---

## 2. Confidence Levels

Debe soportar como mínimo:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT_DATA

La fuente usa ocasionalmente expresiones intermedias como MEDIUM_HIGH en ejemplos, pero no define una escala numérica final.

---

## 3. Epistemic State

Debe poder distinguir:

- OBSERVED
- DERIVED
- INFERRED
- HYPOTHESIZED
- CONFIRMED
- UNKNOWN

---

## 4. Confidence Dimensions

Puede incluir:

- DATA_RELIABILITY
- DATA_COVERAGE
- CONTEXT_QUALITY
- SAMPLE_SUFFICIENCY
- TEMPORAL_FIT
- SCOPE_FIT
- MECHANISM_STRENGTH
- EVIDENCE_CONSISTENCY
- ALTERNATIVE_SEPARATION
- CONTRADICTION_LEVEL
- MISSING_EVIDENCE
- EXPLANATORY_COVERAGE

---

## 5. Confidence Cap

Debe poder representar:

- cap source;
- capped level;
- reason.

Ejemplo:
- DATA_QUALITY_CAP = MEDIUM.

---

## 6. Uncertainty Object

Puede representar:

- uncertainty_type;
- description;
- materiality;
- criticality;
- resolvability;
- required_evidence;
- affected_claims;
- confidence_impact.

---

## 7. Uncertainty Types

Debe poder distinguir:

- DATA_UNCERTAINTY
- CONTEXT_UNCERTAINTY
- MEASUREMENT_UNCERTAINTY
- MODEL_UNCERTAINTY
- CAUSAL_UNCERTAINTY
- SCOPE_UNCERTAINTY
- TEMPORAL_UNCERTAINTY
- IMPACT_UNCERTAINTY
- FORECAST_UNCERTAINTY
- KNOWLEDGE_UNCERTAINTY

---

## 8. Known Unknown

Debe poder marcar:

- KNOWN_UNKNOWN

No puede modelarse exhaustivamente UNKNOWN_UNKNOWN, pero sí conservar safeguards que reduzcan overconfidence.

---

## 9. Uncertainty Materiality

Debe poder distinguir conceptualmente:

- low materiality;
- material;
- high materiality;
- critical unknown.

---

## 10. Resolvability

Puede clasificarse:

- RESOLVABLE_NOW
- WITH_NEW_DATA
- OVER_TIME
- NOT_RESOLVABLE

---

## 11. Evidence Item

Debe poder conservar:

- source;
- strength;
- independence;
- reliability;
- directness;
- diversity;
- freshness;
- scope;
- temporal relevance;
- claim relation.

---

## 12. Evidence Dependency

Debe poder marcar:

- DEPENDENT_EVIDENCE

para evitar double counting.

---

## 13. Contradiction

Debe poder representar:

- contradiction;
- materiality;
- decisive_or_not;
- affected hypothesis/claim;
- confidence effect.

---

## 14. Alternative Separation

Debe poder expresar:

- surviving alternatives;
- separation strength;
- challenger state;
- confidence effect.

---

## 15. Completeness

Debe mantenerse separado de confidence.

Puede representar:

- COMPLETE_ENOUGH
- PARTIAL
- INCOMPLETE

sin fijar enum definitivo.

---

## 16. Confidence by Diagnostic Layer

Debe poder haber confidence independiente para:

- measurement;
- signal;
- symptom;
- root cause;
- constraint;
- current impact;
- future impact;
- severity;
- overall answer.

---

## 17. Confidence Target

Todo confidence debe apuntar a:

- claim;
- question;
- diagnostic output específico.

No debe existir confianza global sin target.

---

## 18. Confidence History

Debe poder conservar:

- previous level;
- new level;
- timestamp;
- evidence/reason for change.

---

## 19. Confidence Freshness / Decay

Debe poder conservar:

- assessed_at;
- domain;
- recency expectation;
- stale status;
- decay reason.

La fuente no define fórmula de decay.

---

## 20. Applicability Confidence

Para conocimiento recuperado puede existir:

- source authority;
- source validity;
- version;
- applicability confidence;
- retrieval confidence.

Debe quedar separado de case evidence confidence.

---

## 21. Negative Claim State

Debe poder distinguir:

- NO_EVIDENCE
- EVIDENCE_OF_NO_PROBLEM
- EVIDENCE_OF_STABILITY

---

## 22. Invalidation Confidence

Debe poder representar confidence al rechazar una hypothesis.

---

## 23. Confidence Improvement Requirement

Debe poder registrar:

- current level;
- desired level;
- missing evidence;
- next evidence/test required;
- expected information gain.

---

## 24. Claim Breadth

Puede asociarse:
- scope/granularity;
- evidence coverage requirement.

---

## 25. Assumption

Debe poder enlazar una assumption con:
- affected claim;
- confidence;
- materiality.

---

## 26. Limitation

Debe poder registrar limitaciones concretas y claim-specific.

---

## 27. User-facing Transparency

La capa de presentación debe poder consumir:
- confidence;
- epistemic_state;
- known/likely/unknown;
- specific limitation.

---

## 28. Boundaries

D11 no debe:
- inventar certeza;
- cambiar evidencia;
- decidir prioridad;
- cerrar root cause por sí solo;
- convertir retrieval similarity en business truth.

---

## 29. Elementos no definidos

No están definidos:
- JSON Schema;
- score formula;
- Bayesian probability model;
- numeric thresholds;
- database schema;
- exact decay function;
- API;
- confidence aggregation formula.
