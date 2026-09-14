# Fase 04 · P00 — Policies y guardrails de priorización

## Separaciones duras

1. **DIAGNOSIS ≠ DECISION.**
2. **DIAGNOSTIC ORDER ≠ DECISION ORDER.**
3. **PRIORITY ≠ SEVERITY.**
4. **PRIORITY ≠ IMPACT.**
5. **PRIORITY ≠ URGENCY.**
6. **PRIORITY ≠ CONSTRAINT.**
7. **PRIORITY ≠ CONFIDENCE.**
8. **PRIORITY ≠ EFFORT.**
9. **PRIORITY ≠ SIMPLE ROI.**
10. **RANK ≠ PRIORITY_TIER.**
11. **DIAGNOSTIC_CONFIDENCE ≠ DECISION_CONFIDENCE.**
12. **PRIORITY_SCORE ≠ TRUTH.**

---

## Mandatory invariants

13. Priority must not be derived solely from severity.
14. Priority must not be derived solely from impact.
15. Lower effort must not automatically produce higher priority.
16. Current constraint must not automatically become rank #1.
17. Low confidence must not automatically mean low priority.
18. Every ranked item must explain `WHY_NOW`.
19. Cuando exista competencia material debe explicar `WHY_BEFORE`.
20. Todo item debe ser traceable.
21. Unsupported facts are forbidden.
22. `UNKNOWN`/`NOT_ASSESSABLE` antes que inventar.
23. Output precision <= input evidence precision.
24. Objective context debe existir o declararse missing.
25. Critical guardrails can override ordinary objectives.
26. Hard dependencies can alter order.
27. Shared causal roots must not inflate priority by duplication.
28. F4 must not generate implementation playbooks.
29. Ties must be allowed.
30. Priority is dynamic and must include `as_of`.
31. Every material priority should declare what could change it.

---

## Evidence integrity

32. El LLM no puede inventar:
- revenue exposure;
- cash impact;
- stock coverage;
- confidence;
- dependency;
- constraint;
- effort;
- probability.

33. Toda dimensión decisional material necesita soporte identificable.
34. No transformar una clasificación cualitativa en falsa precisión monetaria.
35. No ocultar conflicting evidence.

---

## Guardrail precedence

36. Objetivos ordinarios no pueden neutralizar:
- survival;
- security;
- legal/compliance integrity;
- financial integrity;
- business continuity.

37. “Growth” no justifica ignorar cash threat.
38. “Strategic” no justifica saltar hard dependency.
39. “High ROI” no justifica saltar safety/continuity.

---

## Anti-bias

40. Resistir prominence bias.
41. Founder anxiety no determina ranking.
42. Latest Slack message no determina ranking.
43. Complaint volume alone no determina ranking.
44. Agency opinion no determina ranking.
45. Team politics no determina ranking.
46. Recency bias no determina ranking.
47. Easy wins no deben dominar sistemáticamente.

---

## Comparative reasoning

48. Una explicación absoluta no basta si existe competencia material.
49. El motor debe justificar precedencia relativa.
50. Opportunity cost debe permanecer visible.
51. Resources/attention son limitados.

---

## Uncertainty

52. Validation puede ser prioridad.
53. Low diagnostic confidence + catastrophic potential no se descarta.
54. Decision confidence debe degradarse si el ranking es inestable.
55. No fabricar diferencias entre candidatos equivalentes.
56. Context insufficient debe poder detener el ranking.

---

## Phase boundary

57. Prohibido en F4:
- implementation steps;
- playbook;
- campaign plan;
- code changes;
- creative brief;
- exact remediation;
- execution sequence.

58. References estructurales para expresar dependencies sí son válidas.

---

## LLM governance

59. El LLM no controla:
- schemas;
- access;
- hard guardrails;
- financial calculations;
- identity;
- rule versions;
- mandatory dependencies;
- evidence provenance.

60. El LLM no puede ignorar una regla determinista porque “parezca razonable”.

---

## Emergency semantics

61. `P0_EMERGENCY` debe ser excepcional.
62. No usarlo como etiqueta frecuente.
63. Debe responder a amenazas inmediatas de critical integrity/continuity.

---

## Failure honesty

64. No fabricar decision queue para ocultar:
- context insufficient;
- invalid input;
- conflicting evidence.
65. `NOT_ASSESSABLE` es una salida válida.
