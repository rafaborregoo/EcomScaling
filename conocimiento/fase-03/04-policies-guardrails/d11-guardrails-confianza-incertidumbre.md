# Fase 03 · D11 — Policies y guardrails de confianza e incertidumbre

## Principios fundamentales

1. **CONFIDENCE MUST COME FROM EVIDENCE, NOT LINGUISTIC CERTAINTY.**
2. **HIGH ≠ ABSOLUTE CERTAINTY.**
3. **CONFIDENCE IS CLAIM-SPECIFIC.**
4. **CONFIDENCE ≠ COMPLETENESS.**
5. **RETRIEVAL CONFIDENCE ≠ DIAGNOSIS CONFIDENCE.**
6. **VECTOR SIMILARITY ≠ BUSINESS TRUTH.**
7. **EVIDENCE COUNT ≠ EVIDENCE STRENGTH.**
8. **NO EVIDENCE ≠ EVIDENCE OF NO PROBLEM.**
9. **CAUSE CONFIDENCE ≠ SEVERITY CONFIDENCE.**
10. **RISK ≠ CERTAINTY.**

---

## Evidence

11. No inflar confidence con métricas dependientes del mismo source.
12. Preservar contradictions.
13. Direct observation puede ser unreliable si la medición falla.
14. Anecdotal evidence no debe dominar.
15. Histórico tenant-specific aporta prior, no proof actual.

---

## Confidence caps

16. Low critical data quality debe limitar confidence.
17. Coverage insuficiente debe limitar global claims.
18. Horizon inadecuado debe degradar confidence.
19. External explanation sin external evidence debe quedar capped.
20. Broad structural claims requieren más evidence.

---

## Epistemic states

21. No presentar OBSERVED, DERIVED, INFERRED e HYPOTHESIZED como equivalentes.
22. UNKNOWN es una salida válida.
23. CONFIRMED requiere validación suficiente.
24. Assumption nunca debe presentarse como fact.

---

## Alternatives

25. Weak separation impide high confidence.
26. El número de alternatives importa menos que la fuerza de las que sobreviven.
27. No ocultar challenger material.
28. Buscar evidence contradictoria antes de elevar confidence.

---

## Negative claims

29. “No hay problema” requiere coverage suficiente.
30. Si data falta, usar NO_EVIDENCE.
31. Solo usar EVIDENCE_OF_STABILITY con medición completa y estable.
32. Rejection confidence también debe explicitarse.

---

## Uncertainty

33. No ocultar critical unknowns.
34. No usar boilerplate genérico.
35. La limitation debe ser específica.
36. No convertir uncertainty en un único porcentaje opaco.
37. Known unknowns deben quedar visibles.
38. Unknown unknowns obligan a mantener humildad estructural.

---

## RAG

39. Retrieval similarity no prueba applicability.
40. Source authority no sustituye case evidence.
41. Stale knowledge reduce applicability.
42. Expert heuristic solo aporta prior support salvo validación del caso.

---

## Language

43. HIGH: lenguaje fuerte pero no absoluto.
44. MEDIUM: “la explicación más probable”.
45. LOW: “compatible con”.
46. INSUFFICIENT: “no puede determinarse”.
47. Prohibido “está claro que” cuando confidence no sea HIGH.

---

## Freshness

48. Confidence puede caducar.
49. No aplicar decay universal.
50. Recency debe ser domain-specific.
51. Context change puede invalidar historical applicability.

---

## Cost of error

52. Cuanto mayor el coste de falsa certeza, más conservador debe ser el reporting.
53. Pero low confidence no debe ocultar serious risk.

---

## Positive claims

54. Las mejoras requieren el mismo rigor.
55. No celebrar noise como sustained improvement.
56. Opportunity claims deben reconocer counterfactual uncertainty.

---

## Boundary

57. D11 no decide priority.
58. D11 no convierte confidence en acción.
59. D11 no sustituye causal validation.
60. El sistema debe poder decir “I DON'T KNOW YET”.
