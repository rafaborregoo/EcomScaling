# Fase 03 · D04 — Policies y guardrails de salud

## Reglas fundamentales

1. **MATURITY ≠ HEALTH.**
2. **ONE KPI ≠ CAPABILITY HEALTH.**
3. **SALES PERFORMANCE ≠ BUSINESS HEALTH.**
4. **STATE ≠ CAUSE.**
5. **HEALTH ≠ PRIORITY.**
6. **SEVERITY ≠ HEALTH.**
7. **CURRENT_HEALTH ≠ SCALING_READINESS.**
8. **NOT OPTIMAL ≠ UNHEALTHY.**
9. **Ausencia de datos ≠ HEALTHY.**
10. **Heatmap ≠ reasoning.**

---

## Contexto y baselines

11. No clasificar CAC, CVR, refund rate u otra métrica mediante umbral universal sin contexto.
12. Usar self baseline y business target cuando existan.
13. No depender completamente de benchmarks externos.
14. D4 debe heredar incertidumbre de D1.
15. D4 debe usar contexto de D2.
16. D4 debe conservar maturity de D3 separada de current health.

---

## Agregación

17. No ocultar un desastre local detrás de un parent global HEALTHY.
18. No degradar automáticamente toda una capability por un subsegmento pequeño.
19. Exposure debe influir en la interpretación.
20. Conservar heterogeneidad entre segmentos.
21. No reducir health a un único score opaco.

---

## Riesgo

22. HEALTHY puede coexistir con HIGH RISK.
23. Current health puede ser sano y near-term risk crítico.
24. Leading indicators deben poder activar warning antes de daño.
25. No usar solo lagging indicators.

---

## Evidencia

26. Incluir evidencia positiva además de anomalías.
27. Conservar evidence contradictoria.
28. No elevar un estado a BAD/CRITICAL cuando señales relevantes lo contradicen sin resolver la inconsistencia.
29. `NOT_ASSESSABLE` debe utilizarse cuando la evidencia no permite evaluar.

---

## Causalidad

30. D4 no debe afirmar root cause.
31. D4 puede registrar primary/downstream sospechado, pero no causalidad formal.
32. No degradar Acquisition solo porque revenue caiga.
33. No contar dos efectos downstream como problemas causales independientes.
34. Health clusters no equivalen a causal clusters.

---

## Priorización

35. WORST HEALTH ≠ HIGHEST PRIORITY AUTOMATICALLY.
36. D4 no debe decidir qué atacar primero.
37. Un CRITICAL reciente puede competir con un BAD crónico; F4 decide prioridad.

---

## Economía

38. No clasificar Acquisition sin unit economics.
39. Un CAC alto puede ser HEALTHY si está dentro de economics.
40. Un CAC bajo puede ser CRITICAL si destruye contribution.
41. Revenue growth no debe ocultar margin, cash, refunds o inventory deterioration.

---

## Modelo de negocio

42. Business criticality debe adaptarse al modelo.
43. No imponer el mismo registry crítico a DTC, subscription y marketplace.
44. Expert knowledge no puede imponer business-specific health sin evidencia del tenant.

---

## Oportunidad

45. HEALTHY no significa optimized.
46. Una oportunidad de mejora no debe convertirse en enfermedad.
47. D4 diagnostica salud, no perfección.

---

## Estados extremos

48. `DISASTER` debe reservarse para condiciones realmente excepcionales.
49. `CRITICAL` debe reflejar daño empresarial grave, rápido o ampliamente propagado.
50. No usar estados extremos como recurso retórico.
