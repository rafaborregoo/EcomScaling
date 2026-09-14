# Fase 03 · D05 — Policies y guardrails del motor de señales

## Principios fundamentales

1. **No todo cambio es señal.**
2. **No toda señal es problema.**
3. **SIGNAL ≠ ANOMALY.**
4. **SIGNAL ≠ SYMPTOM.**
5. **SIGNAL ≠ CAUSE.**
6. **SIGNAL ≠ RECOMMENDATION.**
7. **Statistical significance ≠ business significance.**
8. **Magnitude ≠ business impact.**
9. **Correlation ≠ independent evidence.**
10. **Mathematical contribution ≠ causal attribution.**

---

## Baselines

11. No usar un único baseline para todo.
12. No ignorar baselines contradictorios.
13. No adaptar baseline demasiado pronto.
14. No aprender un estado roto como “new normal”.
15. No congelar para siempre un baseline tras un regime shift confirmado.
16. Contextualizar expected ranges por seasonality, weekday, market, channel, stage y promotion.

---

## Thresholds

17. No usar guru thresholds universales.
18. Preferir business guardrails específicos del negocio.
19. Un threshold técnico casi universal sigue necesitando configuración y contexto.
20. Detectar approaching guardrail, no solo breach.

---

## Statistical safety

21. Proteger small samples.
22. No convertir porcentajes extremos con pocos eventos en señales críticas.
23. No utilizar un método estadístico único para todas las métricas.
24. Preferir métodos robustos cuando los outliers lo exijan.

---

## Evidence

25. No considerar métricas derivadas con inputs compartidos como evidencia independiente.
26. Elevar confidence solo cuando existe corroboración verdaderamente independiente.
27. Preservar signal conflicts.
28. No forzar una business signal cuando la evidencia sugiere data issue.

---

## Deduplication

29. No enviar varias alertas del mismo fenómeno por métricas correlacionadas.
30. Agrupar mediante signal clusters cuando corresponda.
31. No perder evidencia individual al agrupar.

---

## Context

32. No alertar sobre seasonality esperada.
33. No considerar anomaly un cambio esperado por evento conocido.
34. Un cambio contextual puede seguir siendo una señal importante aunque no sea anomalía.
35. Event-linked no significa event-caused.

---

## Segments

36. No escanear millones de segmentos sin elegibilidad.
37. Exigir minimum sample y business exposure en condiciones normales.
38. Permitir excepciones para high-value o critical groups.
39. No ocultar una localized anomaly porque el global sea estable.

---

## Composite signals

40. No crear scores opacos.
41. Todo composite signal debe explicar inputs y contribuciones.
42. Un normalized score interno no sustituye la explicación.

---

## Positive signals

43. Detectar mejoras con el mismo rigor que deterioros.
44. No declarar breakthrough por un periodo aislado.
45. Señales positivas y negativas pueden coexistir y no deben cancelarse.

---

## Historical patterns

46. Un patrón histórico similar no confirma que el outcome vaya a repetirse.
47. Known pattern puede reducir atención solo si está suficientemente explicado.
48. Tenant-specific patterns no deben promoverse automáticamente a reglas globales.

---

## Boundary D5 → D6

49. D5 puede decir CTR deterioration.
50. D5 no puede decir creative fatigue confirmed.
51. D5 puede crear signal clusters.
52. D6 interpreta síntomas.
53. No generar recomendaciones desde una sola señal.

---

## Impact y priority

54. D5 puede estimar impacto preliminar.
55. D5 no decide prioridad final.
56. Exposure debe formar parte de relevancia.
57. Un +200 % en una campaña mínima puede ser LOW relevance.
