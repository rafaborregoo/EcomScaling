# Fase 03 · D06 — Requisitos contractuales del motor de síntomas

## Estado

La fuente define vocabulario, taxonomías, relaciones y estructuras conceptuales, pero no un schema técnico implementado.

No se inventan JSON Schema, tablas, interfaces ni endpoints.

---

## 1. Symptom Object

Un síntoma debería poder representar, cuando aplique:

- symptom id/reference;
- symptom family;
- canonical symptom type;
- label;
- valence;
- capability;
- scope;
- granularity;
- diagnostic depth;
- time role;
- onset;
- duration;
- persistence;
- confidence;
- pattern coherence;
- business relevance;
- related signals;
- supporting evidence;
- contradicting evidence;
- contextual qualifiers.

---

## 2. Symptom Families

Debe poder distinguir:

- acquisition;
- creative;
- conversion;
- offer;
- product;
- retention;
- inventory;
- operations;
- financial;
- data;
- technology;
- team;
- strategy;
- cross-capability.

---

## 3. Valence

Estados conceptuales:

- `NEGATIVE`
- `POSITIVE`
- `NEUTRAL`
- `MIXED`

No debe inferirse valencia solo por dirección de una métrica.

---

## 4. Pattern Coherence

Debe poder registrar factores como:

- same time window;
- same business scope;
- compatible direction;
- known relationship;
- signal quality;
- pattern coherence result.

---

## 5. Related Signals

El síntoma debe poder referenciar:

- required signals;
- supporting signals;
- contradicting signals;
- neutral/stability signals.

No se define un cardinality contract definitivo.

---

## 6. Scope y Granularity

Debe soportar scopes:

- BUSINESS;
- CAPABILITY;
- SUBCAPABILITY;
- CHANNEL;
- MARKET;
- PRODUCT;
- SEGMENT.

También scopes más específicos si la evidencia los soporta.

---

## 7. Parent-child Symptoms

Debe poder relacionarse:

- parent symptom;
- child symptom;
- broader/narrower scope;
- abstraction level.

---

## 8. Diagnostic Depth

Debe poder distinguir:

- `SURFACE`
- `INTERMEDIATE`
- `DEEP`

Ningún nivel implica root cause automáticamente.

---

## 9. Process Position

Puede etiquetarse:

- `UPSTREAM`
- `MIDSTREAM`
- `DOWNSTREAM`

respecto de un proceso o funnel.

---

## 10. Time Role

Debe poder etiquetarse:

- `LEADING`
- `COINCIDENT`
- `LAGGING`

---

## 11. Persistence

Debe poder representar:

- acute;
- recurring;
- chronic;
- persistent.

La fuente no define thresholds temporales universales.

---

## 12. Candidate Relations

D6 puede registrar relaciones no causales:

- `may_precede`
- `may_follow`
- `often_cooccurs`
- `related`

Estas relaciones son input para D7.

---

## 13. Symptom Graph

Debe poder representarse un conjunto de síntomas y relaciones candidatas sin convertirlo todavía en causal graph.

---

## 14. Symptom Decomposition

Debe poder expresar:

- broad symptom;
- decomposed components;
- deeper symptom;
- evidence path.

---

## 15. Symptom Composition

Debe poder agrupar síntomas en un patrón superior.

La composición puede ser:

- same-domain;
- cross-domain;
- cross-capability.

---

## 16. Diagnostic Case Association

Un diagnostic case puede contener múltiples symptoms.

D6 no define todavía hypothesis ni cause definitivas.

---

## 17. Multimodal Evidence

El síntoma puede referenciar evidencia procedente de:

- metrics;
- reviews;
- tickets;
- calls;
- surveys;
- logs;
- other qualitative sources.

---

## 18. Confidence

Debe poder representar confidence del síntoma y, cuando sea necesario, confidence de señales/evidencia subyacente.

La fuente no define fórmula.

---

## 19. Localization

Debe poder conservarse:

- global scope;
- localized scope;
- parent context;
- business share/exposure cuando exista.

---

## 20. Symptom Map

El sistema debe poder producir un mapa de síntomas activos por capability.

Esto es una vista, no el contrato de razonamiento completo.

---

## 21. Diagnostic Memory Reference

Debe poder asociarse, cuando exista:

- previous similar symptom;
- recurrence;
- previous context;
- previous outcome.

La memoria no convierte el patrón en causa.

---

## 22. Boundaries

D6 no debe emitir como hechos confirmados:

- hypothesis;
- root cause;
- constraint;
- action;
- recommendation;
- priority.

---

## 23. Elementos no definidos

No están definidos:

- JSON Schema;
- DB schema;
- exact state machine;
- weighting;
- symptom confidence formula;
- clustering algorithm;
- graph implementation;
- persistence layer;
- API.
