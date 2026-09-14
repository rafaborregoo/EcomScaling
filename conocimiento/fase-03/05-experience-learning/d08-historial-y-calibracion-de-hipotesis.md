# Fase 03 · D08 — Experience & Learning de hipótesis

## Propósito

D8 produce uno de los datasets más valiosos para aprendizaje posterior: el historial completo de hypotheses generadas, apoyadas, debilitadas, invalidadas o confirmadas.

---

## 1. Hypothesis Ledger History

Debe conservar:

- generated;
- tested;
- supported;
- weakened;
- invalidated;
- confirmed;
- expired;
- reopened.

No deben borrarse hipótesis rechazadas.

---

## 2. Why Rejected Hypotheses Matter

Sirven para:

- traceability;
- future learning;
- avoid repeated investigation;
- agent evaluation;
- calibration.

---

## 3. Historical Hypothesis Performance

F9 puede medir:

- confirmation rate;
- false positive rate;
- invalidation rate;
- time to discrimination.

---

## 4. Agent Calibration

Puede evaluarse si un agente:

- overdiagnoses;
- underdiagnoses;
- proposes too many hypotheses;
- ignores contradictions;
- reaches certainty too early.

Ejemplo conceptual:

Si Creative Agent propone fatigue en 80 % de casos y se confirma en 30 %, existe posible bias.

---

## 5. Tenant-specific Priors

La recurrencia histórica puede elevar priors locales.

Ejemplo:

> Las dos últimas veces que apareció este patrón terminó siendo stockout del hero SKU.

Esto aumenta plausibility, no prueba el caso actual.

---

## 6. Cold-start vs Tenant Prior

Sin histórico:
- general business knowledge;
- lower confidence.

Con suficiente historial:
- tenant-specific prior puede ser más relevante.

---

## 7. Discriminating Evidence Learning

Puede aprenderse qué evidencias separan mejor ciertas hypothesis families.

Ejemplos:

- creative age vs audience saturation;
- device-level CVR vs price resistance;
- logs vs provider outage.

---

## 8. Test Performance

Puede almacenarse por diagnostic test:

- information gain achieved;
- cost;
- latency;
- usefulness;
- false discrimination;
- repeated value.

---

## 9. Confirmation / Invalidation Patterns

La memoria puede conservar qué evidence patterns históricamente:

- confirmaron;
- invalidaron;
- dejaron inconclusa;

una hypothesis.

---

## 10. Multi-agent Learning

Puede medirse por agente:

- hypothesis precision;
- false positive rate;
- invalidation rate;
- average confidence calibration;
- time to useful hypothesis.

---

## 11. Success Learning

También deben conservarse positive cases.

F9 puede estudiar:

- qué hypothesis explicaron mejoras;
- qué cambios precedieron outcomes positivos;
- qué causal paths suelen aparecer en mejoras.

---

## 12. Hypothesis Recurrence

Una hypothesis recurrente puede:

- aumentar prior tenant-specific;
- señalar posible structural driver;
- orientar D9.

No debe convertirse automáticamente en causa estructural.

---

## 13. Historical Case Memory

Un case puede conservar:

- symptom;
- hypotheses;
- evidence;
- tests;
- winner;
- rejected alternatives;
- root cause final si D9 la valida;
- outcome;
- recovery.

---

## 14. Version / Scope History

Debe preservarse cuando una hypothesis:

- se estrecha;
- se divide;
- se fusiona;
- cambia de periodo válido.

---

## 15. Evidence Quality Learning

A largo plazo puede medirse qué fuentes son más útiles para discriminar hypotheses en ese tenant.

Esto no sustituye D1 reliability.

---

## 16. Knowledge Feedback

Si una relationship/hypothesis se confirma repetidamente, puede convertirse en:

- tenant pattern;

y eventualmente ser candidata a revisión para conocimiento más general.

La promoción global requiere gobernanza separada.

---

## 17. Boundaries

D08 no define:

- automatic global promotion;
- cross-tenant learning;
- decay;
- autonomous model retraining;
- reinforcement learning;
- automatic business action.

Estos mecanismos pertenecen a fases posteriores.
