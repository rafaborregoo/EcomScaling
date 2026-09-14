# Fase 04 · P05 — Policies y guardrails de constraints y dependencias

## Separaciones fundamentales

1. **WEAKNESS ≠ CONSTRAINT.**
2. **WORST METRIC ≠ CONSTRAINT.**
3. **BIGGEST PROBLEM ≠ CONSTRAINT.**
4. **LOW MATURITY ≠ CURRENT CONSTRAINT.**
5. **DEPENDENCY ≠ CONSTRAINT.**
6. **BLOCKER ≠ PRIORITY.**
7. **BUSINESS IMPORTANCE ≠ EXECUTION ORDER.**
8. **ROOT CAUSE ≠ ALWAYS FIRST INTERVENTION POINT.**
9. **RESOURCE CONFLICT ≠ CAUSAL DEPENDENCY.**
10. **HIGH CENTRALITY ≠ PRIORITY #1.**
11. **ALTERNATIVE EXISTS ≠ EFFECTIVE REDUNDANCY.**
12. **CURRENT CONSTRAINT ≠ PERMANENT CONSTRAINT.**

---

## Constraint discipline

13. No identificar constraint por score más bajo.
14. No identificarlo por maturity más baja.
15. No identificarlo por coste de departamento.
16. Founder opinion es hypothesis, no proof.
17. Si todo es constraint, el concepto pierde utilidad.
18. Constraint debe relacionarse con system output.
19. Debe existir falsifier.
20. POSSIBLE CONSTRAINT es salida válida.

---

## Objective dependence

21. No buscar constraint sin objective.
22. Si objective cambia, constraint puede cambiar.
23. No optimizar departmental KPI contra system goal.

---

## Local optimization

24. No invertir capacidad en non-constraint sin comprobar throughput.
25. +capacity local ≠ +business output.
26. 100% utilization everywhere es peligroso.
27. Idle capacity no siempre es waste.
28. Slack puede ser protective.

---

## Constraint migration

29. No asumir que constraint no cambia.
30. Tras elevarlo, buscar next constraint.
31. Constraint shadow debe permanecer visible.
32. No proyectar infinite value después de release.

---

## Dependencies

33. No inventar A before B porque parezca ordenado.
34. Dependency debe tener lógica causal/business.
35. No serializar trabajo que puede ejecutarse en paralelo.
36. Soft dependency no debe bloquear indefinidamente.
37. No esperar perfect prerequisite.
38. Buscar minimum viable prerequisite.
39. Buscar alternative paths.

---

## Blocked candidates

40. Blocked ≠ low importance.
41. High priority puede coexistir con blocked.
42. Un blocker pequeño puede tener gran unlock value.
43. No confundir unlock value con strategic value propio.

---

## Root vs containment

44. No imponer root cause first siempre.
45. No tratar siempre downstream symptom.
46. Distinguir containment de structural removal.
47. Immediate customer harm puede justificar contención mientras se trabaja upstream.

---

## Resource conflicts

48. Shared resource no implica causal dependency.
49. Founder/engineering/creative/cash pueden ser bottleneck resources.
50. Más headcount no arregla necesariamente decision-rights constraint.
51. Constraint pollution debe investigarse antes de ampliar capacity.

---

## Queue evidence

52. Queue puede indicar constraint.
53. Queue no prueba constraint automáticamente.
54. Poor scheduling, batching o unnecessary work pueden producir cola.
55. Distinguir queue-before, delay-after y true limiting node.

---

## Redundancy

56. No asumir que redundancy aparente es real.
57. Revisar shared upstream/common-mode failure.
58. Switching lead time importa.
59. Partial redundancy ≠ full redundancy.
60. Redundancy no es waste en critical nodes.

---

## Dependency risk

61. Healthy dependency no necesita eliminarse.
62. El problema es dependence + material exposure + fragility + low alternatives.
63. Objective no es zero dependencies.
64. Manage critical dependencies.

---

## External actors

65. No asumir control directo sobre supplier/platform/regulator.
66. Distinguir control, influence y uncontrollable.
67. Para uncontrollable dependency, pensar resiliencia/adaptación.

---

## Impact and opportunity

68. Opportunity theoretical value debe ser capped por actual constraints.
69. Impact estimate debe considerar constraint context.
70. Constraint release value depende del siguiente bottleneck.

---

## False causality / false dependency

71. No confundir organizational convention con hard dependency.
72. "We need perfect attribution" puede ser overstated.
73. Minimum viable evidence puede ser suficiente.

---

## Investment discipline

74. No automate non-constraint por defecto.
75. No hire before knowing bottleneck.
76. No buy more stock si demand es constraint.
77. No buy more traffic si fulfillment es constraint.
78. No add people si approval rights siguen siendo bottleneck.

---

## Falsifiability

79. Toda constraint hypothesis material debe poder invalidarse.
80. Si nada puede cambiar nuestra opinión, no estamos razonando.
81. Constraint removal debe evaluarse por system throughput, no local metric.

---

## Dynamic graph

82. Ranking sin dependency graph es peligroso.
83. Cuando graph cambia, priorities deben reconsiderarse.
84. Blocker resolution puede activar varias prioridades.
85. Dependency failure puede bloquear varias simultáneamente.

---

## Boundary

86. P05 no decide priority por constraint solo.
87. P05 no prescribe F5.
88. P05 no convierte graph en linear sequence automáticamente.
89. P05 no elimina slack/redundancy indiscriminadamente.
