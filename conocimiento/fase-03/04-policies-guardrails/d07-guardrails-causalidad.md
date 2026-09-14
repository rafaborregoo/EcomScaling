# Fase 03 · D07 — Policies y guardrails del grafo causal

## Principios epistemológicos

1. **PLAUSIBLE ≠ PROVEN.**
2. **CORRELATION ≠ CAUSATION.**
3. **EDGE PRIOR ≠ CASE CAUSAL CONFIDENCE.**
4. **LINEAGE ≠ CAUSAL GRAPH.**
5. **GRAPH CENTRALITY ≠ BUSINESS PRIORITY.**
6. **EVENT-LINKED ≠ EVENT-CAUSED.**

---

## Edge discipline

7. No crear causal edge sin mechanism.
8. No crear edge solo por correlación histórica.
9. No guardar expert slogans como edges.
10. Todo edge debe tener diagnostic usefulness.
11. No conectar todo con todo.
12. No usar nodos vagos como “Bad Marketing”.
13. No usar recomendaciones como nodos causales.
14. No usar labels subjetivos no observables como “Great Brand”.

---

## Case evidence

15. Toda relación aplicada a un caso necesita case evidence.
16. Correlation-only no puede generar HIGH confidence.
17. Latent nodes requieren más evidencia.
18. External nodes suelen requerir más cautela por baja observabilidad.

---

## Temporal

19. Cause debe preceder effect.
20. Si el effect comienza antes, la candidate cause no explica el onset.
21. Aplicar expected lag por dominio.
22. No exigir efecto inmediato cuando el mecanismo tiene lag.

---

## Scope

23. Cause y effect deben tener scope compatible.
24. Un cambio en France no explica Spain sin mecanismo adicional.
25. Scoped evidence debe prevalecer sobre agregados.

---

## Magnitude

26. La candidate cause debe tener magnitud/exposure suficiente.
27. Un node que afecta 2 % del negocio no explica por sí solo -30 % global salvo mecanismo adicional.
28. Permitir partial/contributory causes.

---

## Multicausality

29. No forzar una única root cause.
30. Permitir causas simultáneas.
31. Modelar interactions cuando A+B sean necesarios.
32. No asumir linealidad.

---

## Confounders

33. Modelar confounders explícitamente.
34. No inferir causalidad porque dos variables cambien juntas.
35. Evitar collider reasoning ingenuo.
36. D12 profundizará confounder handling; D7 debe preservar uncertainty.

---

## Measurement

37. Diferenciar real-world variable y observed metric.
38. Tracking failure puede cambiar observed purchases sin cambiar actual purchases.
39. No diagnosticar business deterioration desde una measurement path rota.

---

## Counterfactuals

40. Counterfactual proxy no equivale a randomized experiment.
41. Explicitar assumptions.
42. Los controles deben ser comparables.

---

## Knowledge sources

43. Separar system logic, internal evidence, external knowledge, expert heuristics y tenant learned.
44. Tenant learned relation no debe convertirse automáticamente en global edge.
45. Expert heuristic no debe dominar evidence contraria del tenant.

---

## D7 boundary

46. D7 no decide root cause.
47. D7 no prescribe acciones.
48. D7 no prioriza.
49. D7 debe preservar competing paths.
50. D7 debe exponer weak links y missing evidence.
