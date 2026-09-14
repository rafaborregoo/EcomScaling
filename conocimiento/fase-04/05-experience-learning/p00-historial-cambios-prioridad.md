# Fase 04 · P00 — Experience & Learning de prioridades

## Propósito

P00 no define todavía un motor de aprendizaje de priorización, pero sí especifica eventos e historial que deben conservarse porque posteriormente alimentarán F9.

Por tanto esta capa contiene únicamente los learning inputs explícitamente soportados por la fuente.

---

## 1. Priority Change History

Cuando una prioridad cambia materialmente debe poder registrarse:

- previous rank/state;
- current rank/state;
- reason;
- as_of;
- changed context.

Evento:

`PRIORITY_CHANGED`

---

## 2. Ranking Change Reason

Ejemplo soportado por la fuente:

- Inventory Risk rank #4
- pasa a rank #1
- porque projected stockout pasó de 18 días a 5 días.

Este tipo de cambio permite estudiar cómo evoluciona la decisión con el contexto.

---

## 3. Dynamic Priority History

Las prioridades caducan.

Debe poder conservarse:

- decision horizon;
- objective context;
- active constraints;
- active guardrails;
- evidence state;
- previous ranking.

Esto permite comparar decisiones en distintos momentos sin tratarlas como contradicciones.

---

## 4. Ranking Stability History

Puede conservarse cuándo:

- small input changes;
- produjo large ranking change;
- generó `RANKING_INSTABILITY`.

Esto puede ser útil posteriormente para calibrar decision confidence.

---

## 5. Decision Confidence History

P00 distingue:

- diagnostic confidence;
- decision confidence.

El histórico puede almacenar cómo cambia decision confidence cuando cambian:

- evidence;
- context;
- dependencies;
- objectives;
- ranking stability.

---

## 6. Priority Invalidators

Cada item material puede conservar:

- what_would_change_priority[].

Posteriormente puede observarse qué invalidators realmente ocurrieron.

La fuente no define todavía cómo aprender de ello.

---

## 7. Exclusion History

Puede conservarse por candidato:

- exclusion reason;
- whether it later became a validation need;
- whether it re-entered the portfolio.

La fuente define reasons y la posibilidad de convertir insufficient evidence en validation need.

---

## 8. Blocked State History

Puede registrarse:

- blocked_by;
- blocking reason;
- unblocked event/context.

Esto permite entender cambios de precedencia por dependencies.

---

## 9. Trace as Learning Input

`DECISION_TRACE` conserva:

- factors considered;
- rules triggered;
- overrides;
- ranking changes;
- uncertainties;
- versions.

Ese histórico es materia prima para aprendizaje posterior.

---

## 10. Boundaries

P00 NO define:

- automatic learning of ranking weights;
- cross-tenant preference learning;
- reinforcement learning;
- reward model;
- autonomous priority optimization;
- automatic policy mutation.

Esos mecanismos pertenecen a fases posteriores.
