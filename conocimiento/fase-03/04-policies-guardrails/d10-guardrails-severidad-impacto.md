# Fase 03 · D10 — Policies y guardrails de severidad e impacto

## Separaciones fundamentales

1. **HEALTH ≠ SEVERITY.**
2. **SEVERITY ≠ IMPACT.**
3. **IMPACT ≠ PRIORITY.**
4. **CAUSE CONFIDENCE ≠ IMPACT CONFIDENCE.**
5. **CURRENT IMPACT ≠ FUTURE RISK.**
6. **REALIZED LOSS ≠ OPPORTUNITY COST.**
7. **REVERSIBILITY ≠ RECOVERABILITY.**
8. **BUSINESS CRITICALITY ≠ CURRENT IMPACT.**

---

## Severity discipline

9. Metric magnitude no define severity.
10. No usar porcentaje aislado como gravedad empresarial.
11. `BUSINESS_THREAT` debe ser excepcional.
12. Critical-path failure puede ser severo inmediatamente.
13. High uncertainty no obliga a low severity.
14. Local CRITICAL no implica global CRITICAL.

---

## Exposure

15. Elegir denominador correcto.
16. No usar spend share si customer/contribution exposure es más relevante.
17. Scope pequeño puede ser material si concentra contribution/LTV.
18. No generalizar scope local.

---

## Impact evidence

19. Separar observed, estimated, inferred y forecast.
20. No presentar forecast como observed.
21. No presentar inferred impact como hecho.
22. Mantener assumptions visibles.

---

## Financial quantification

23. Evitar falsa precisión.
24. Usar rangos si el modelo tiene incertidumbre.
25. No equiparar revenue loss con economic loss.
26. Considerar contribution.
27. Considerar settlement lag y periodos abiertos.
28. Si no puede cuantificarse, usar directional o unknown.

---

## Risk

29. No inventar probabilidades como 13.7 % sin modelo calibrado.
30. Preferir LOW/MEDIUM/HIGH likelihood o scenario ranges.
31. Forward risk debe etiquetarse aparte.
32. Revenue-at-risk no es realized revenue loss.

---

## Propagation

33. No sumar impactos downstream como pérdidas independientes si representan la misma cadena.
34. Evitar double counting entre revenue, contribution y cash.
35. Distinguir direct impact de cascade.
36. Systemic propagation requiere evidencia de path.

---

## Buffers

37. Considerar redundancy y absorption capacity.
38. Misma cause no implica misma severity en todos los tenants.
39. No ignorar safety stock, backup providers, cash buffers o spare capacity.

---

## Recurrence

40. Recurrence puede elevar structural severity.
41. No convertir recurrencia en severity extrema automáticamente.
42. Separar acute y cumulative damage.

---

## Opportunity cost

43. Opportunity cost requiere evidencia suficiente.
44. No declararlo realized loss.
45. Confidence de opportunity cost suele ser menor.

---

## Priority boundary

46. D10 no decide qué atacar primero.
47. Un problema HIGH puede ser más prioritario que uno CRITICAL dependiendo de F4.
48. No mezclar effort, strategic value o intervention order dentro de severity.

---

## Measurement failures

49. Tracking failure puede tener Data Impact CRITICAL sin revenue loss confirmado.
50. No atribuir revenue perdido inexistente.
51. Business Performance Impact puede quedar UNKNOWN.

---

## Language

52. Ajustar lenguaje a evidence/confidence.
53. No decir “exact loss” cuando es una estimación.
54. Declarar confidence y limitations.

---

## Alerting

55. D10 puede producir escalation inputs.
56. D10 no define notification policy.
