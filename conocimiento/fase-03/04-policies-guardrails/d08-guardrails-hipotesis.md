# Fase 03 · D08 — Policies y guardrails del motor de hipótesis

## Principios

1. **FIRST PLAUSIBLE CAUSE ≠ DIAGNOSIS.**
2. **PRIOR ≠ CONCLUSION.**
3. **SUPPORTED ≠ CONFIRMED.**
4. **ROOT_CAUSE_CANDIDATE ≠ ROOT_CAUSE.**
5. **NOT OBSERVED ≠ OBSERVED ABSENT.**
6. **CONFIDENCE ≠ COVERAGE.**
7. **ACCOUNTING CONTRIBUTION ≠ CAUSAL CONTRIBUTION.**
8. **DIAGNOSTIC ACTION ≠ BUSINESS ACTION.**

---

## Multiple hypotheses

9. Mantener múltiples explanations razonables.
10. No quedarse con una única hypothesis por comodidad.
11. No generar decenas de candidates irrelevantes.
12. Mantener challenger mientras exista incertidumbre material.

---

## Confirmation bias

13. Buscar activamente evidence against.
14. No recolectar solo evidence for.
15. Un common cause no es automáticamente actual cause.
16. Historical tenant pattern aumenta prior, no confirma caso actual.

---

## Falsifiability

17. Toda hypothesis importante debe poder falsarse.
18. Evitar statements vagos o no testables.
19. Si no existe ruta causal válida en D7, descartar candidate.

---

## Evidence

20. Missing evidence crítica limita confidence.
21. No contar evidence derivada del mismo source como independiente.
22. Priorizar independent corroboration.
23. Conservar evidence conflicts.
24. No forzar resolución si dos fuentes fiables contradicen.
25. Stale evidence debe degradarse.

---

## Fit

26. Cause debe preceder effect.
27. Scope debe coincidir.
28. Magnitude debe ser suficiente.
29. Context debe ser compatible.
30. Maturity puede elevar plausibility, no confirmar.
31. Health puede contradecir una hypothesis, no demostrar la opuesta.

---

## Confidence

32. `CONFIRMED` debe ser raro.
33. Correlation-only no puede justificar confirmation.
34. HIGH requiere evidence fuerte, pocas contradicciones y alternatives mayormente rechazadas.
35. INCONCLUSIVE es mejor que certainty theater.

---

## Coverage

36. No afirmar explicación completa si queda residual material.
37. Partial cause debe mantenerse como partial.
38. Una hypothesis local no explica global si exposure es insuficiente.

---

## Multicausality

39. No forzar causa única.
40. Permitir composite hypotheses.
41. Evitar double counting de hypotheses equivalentes.
42. Aplicar canonicalization.

---

## Root depth

43. No quedarse en downstream metrics como root cause.
44. No sobreprofundizar hasta explicaciones abstractas sin utilidad.
45. D9 decide root cause final.

---

## Tests

46. Tool-first: system data antes de user question.
47. No pedir al usuario datos ya accesibles.
48. Preferir high-information-gain evidence.
49. Cheap evidence first cuando sea razonable.
50. Un diagnostic test no autoriza automáticamente una business action.

---

## Multi-agent

51. No aceptar una hypothesis porque la propone un agente especializado.
52. Todos los agentes deben someterse al mismo evidence standard.
53. Registrar bias/calibration por agente.

---

## Learning

54. No borrar rejected hypotheses.
55. No promover automáticamente tenant pattern a global rule.
56. No usar past success como prueba del caso actual.

---

## Explainability

57. Toda primary hypothesis debe explicar por qué gana.
58. Debe explicar por qué alternatives pierden.
59. Debe declarar missing evidence.
60. Debe declarar qué la falsaría.
