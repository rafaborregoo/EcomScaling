# Fase 03 · D09 — Policies y guardrails de Root Cause & Constraint

## Separaciones fundamentales

1. **SYMPTOM ≠ IMMEDIATE CAUSE.**
2. **IMMEDIATE CAUSE ≠ ROOT CAUSE.**
3. **ROOT CAUSE ≠ UNDERLYING DRIVER.**
4. **ROOT CAUSE ≠ CONSTRAINT.**
5. **CONSTRAINT ≠ WEAKNESS.**
6. **CONSTRAINT ≠ CAPACITY.**
7. **CONSTRAINT ≠ PRIORITY.**
8. **CAUSE ≠ SEVERITY.**

---

## Root cause discipline

9. No detenerse demasiado pronto en surface drivers.
10. No profundizar hasta explicaciones abstractas sin evidence.
11. Solo preguntar “why?” si existe upstream causal branch válida.
12. CONFIRMED debe ser excepcional.
13. PROBABLE y UNRESOLVED son salidas válidas.
14. No forzar closure.

---

## Evidence

15. Correlation no basta.
16. Root cause necesita supported causal chain.
17. Aplicar temporal, scope y magnitude fit.
18. Interventions deben considerar simultaneous changes.
19. Claims sistémicos requieren evidencia más fuerte.
20. Pattern match nunca debe superar direct evidence.

---

## Multicausality

21. No obsesionarse con una única root cause.
22. Permitir primary, secondary y contributing causes.
23. Mantener residual material.
24. No declarar complete explanation si coverage es parcial.

---

## Scope

25. No generalizar una causa local a todo el negocio.
26. No generalizar constraint local.
27. Mantener market/channel/product/warehouse scope.

---

## Constraint discipline

28. Una debilidad no es constraint si no limita target.
29. Una capacity elevada no implica constraint.
30. El constraint debe ser target-dependent.
31. Un constraint debe superar binding/counterfactual test.
32. Puede no existir business constraint en un case.
33. Puede haber varios constraints por scope.
34. Puede haber primary/secondary/latent constraints.

---

## Priority boundary

35. Binding constraint no implica highest priority.
36. Un outage crítico puede tener prioridad inmediata sobre un structural constraint.
37. D9 no decide F4.

---

## Blame avoidance

38. Describir processes/capacities/configurations antes que culpar personas.
39. Human error debe expresarse en términos observables.
40. No inventar process weakness sin evidence.

---

## Measurement

41. Tracking regression puede ser root cause de observability problem sin ser business performance root cause.
42. No convertir measurement failure en business deterioration.

---

## Positive cases

43. D9 debe permitir positive drivers.
44. Una opportunity no necesita root cause.
45. Una mejora observada sí puede tener positive causal driver.

---

## Language

46. Calibrar lenguaje a confidence.
47. No usar “definitively caused by” sin evidencia apropiada.
48. Declarar limitations y residual.
