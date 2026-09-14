# Fase 03 · D02 — Guardrails de contextualización

## Propósito

Estas reglas limitan interpretaciones incorrectas y no deben depender únicamente del RAG.

---

## 1. Reglas de interpretación

1. **No interpretar una métrica aislada como diagnóstico.**
2. **No utilizar benchmarks genéricos como verdad del negocio.**
3. **No comparar periodos solo por proximidad temporal.**
4. **No comparar cohortes de distinta edad como equivalentes.**
5. **No evaluar modelos de negocio diferentes con las mismas expectativas.**

---

## 2. Reglas de mix y segmentación

6. **No atribuir un cambio agregado a rendimiento interno sin comprobar mix.**
7. **Distinguir `PERFORMANCE_CHANGE` de `MIX_SHIFT`.**
8. **Considerar Simpson's paradox cuando cambian los pesos de los segmentos.**
9. **No ocultar scopes locales detrás de promedios globales.**

---

## 3. Reglas de estrategia y economía

10. **No tratar una métrica local peor como deterioro si el business outcome mejora deliberadamente.**
11. **No evaluar ROAS sin economía del producto.**
12. **No confundir crecimiento de revenue con mejora de contribution o cash generation.**
13. **No asumir que una oportunidad económicamente atractiva es financieramente viable ahora.**
14. **No penalizar una decisión estratégica deliberada por desviarse de una checklist genérica.**

---

## 4. Reglas temporales

15. **No tratar promotional lift como structural improvement.**
16. **No interpretar post-promo decline como destrucción de demanda sin considerar pull-forward.**
17. **No ignorar lags plausibles entre cambio y efecto.**
18. **No usar historia previa como baseline limpio después de un `REGIME_CHANGE` sin revisión.**
19. **No comparar series alrededor de `MEASUREMENT_DISCONTINUITY` como si fueran homogéneas.**

---

## 5. Reglas de causalidad

20. **Proximidad temporal no equivale a causalidad.**
21. **La contextualización reduce hipótesis falsas pero no confirma root cause.**
22. **Cuantos más cambios simultáneos existan, menor debe ser la confianza causal inicial.**
23. **No atribuir crecimiento o deterioro a una sola variable cuando existen confounders materiales.**
24. **Variables externas deben tratarse como candidatas, no como explicación automática.**

---

## 6. Reglas de contexto faltante

25. **No rellenar contexto desconocido mediante suposiciones.**
26. **La ausencia de contexto relevante debe conservarse como incertidumbre explícita.**
27. **La profundidad contextual debe adaptarse a la pregunta; no exigir el mismo contexto para todo diagnóstico.**
28. **Una contradicción entre `DECLARED_CONTEXT` y `OBSERVED_CONTEXT` no debe eliminarse ni resolverse silenciosamente.**

---

## 7. Reglas de calidad y evidencia

29. **D2 debe heredar la incertidumbre de D1.**
30. **Una fuente degradada por D1 no puede sostener sola una interpretación contextual fuerte.**
31. **No seleccionar oportunistamente la métrica de atribución más favorable.**
32. **Store revenue, platform attribution y blended metrics deben conservar sus significados distintos.**

---

## 8. Reglas de disponibilidad y capacidad

33. **No interpretar demanda sin comprobar disponibilidad.**
34. **No recomendar más adquisición si capacidad o stock ya limitan el output útil.**
35. **No interpretar una caída de ventas como demanda débil si la oferta estuvo restringida.**

---

## 9. Reglas de experiencia histórica

36. **No usar decisiones previas como justificación automática de una situación actual.**
37. **El historial debe conservar el contexto vigente en cada momento.**
38. **No sobrescribir retrospectivamente snapshots históricos con la configuración actual del tenant.**
