# Fase 03 · D01 — Guardrails para diagnóstico basado en datos

## Propósito

Estas reglas son límites de interpretación y control. No deben depender únicamente de que el modelo las recupere desde el RAG.

---

## 1. Guardrails de freshness y cobertura

1. **No usar un único threshold global de freshness.** La validez depende de la cadencia esperada de la fuente y del uso.
2. **No tratar datos incompletos como completos.** Coverage y missingness deben condicionar confidence y elegibilidad para diagnóstico.
3. **No considerar la calidad como una propiedad necesariamente global.** Debe poder degradarse por scope o segmento.

---

## 2. Guardrails de fuentes y reconciliación

4. **No asumir que una discrepancia equivale a un error.** Las fuentes pueden usar metodologías distintas.
5. **No sumar atribuciones de plataformas como si fueran revenue empresarial.**
6. **No comparar fuentes como equivalentes sin validar definición, scope, periodo y metodología.**
7. **Para fenómenos críticos, preferir source of truth y corroboración independiente antes que una fuente derivada.**

---

## 3. Guardrails semánticos

8. **No mezclar métricas homónimas con definiciones diferentes.**
9. **No mezclar gross, net, total o recognized revenue sin una definición explícita.**
10. **No comparar históricamente una métrica después de definition drift como si su fórmula fuera constante.**
11. **No diagnosticar deterioro de campañas por un cambio de attribution window o attribution model sin controlar ese cambio.**

---

## 4. Guardrails de tracking e ingestión

12. **`HTTP success` no equivale a `data success`.**
13. **Una conexión activa no demuestra que los scopes o permisos sean suficientes.**
14. **Ausencia de datos no equivale a ausencia del fenómeno cuando existe `PERMISSION_GAP`.**
15. **Antes de interpretar un spike o caída extrema como cambio empresarial, descartar duplicación, backfill, schema drift, timestamp corruption o regresión de tracking.**
16. **No utilizar eventos de prueba, sandbox, QA, compras internas o tráfico bot como actividad real cuando puedan identificarse.**

---

## 5. Guardrails sobre valores y estados

17. **`0` no equivale a `NULL`.** Cero puede ser un valor observado; null puede ser ausencia de observación.
18. **Un periodo `OPEN` o `PARTIALLY_SETTLED` no debe tratarse como equivalente a uno `SETTLED`.**
19. **No comparar una ventana parcial con una ventana completa sin alinearlas.**
20. **No ignorar timezone ni day-boundary effects en comparativas diarias.**
21. **No atribuir a negocio un cambio que pueda explicarse por FX sin revisar moneda y conversión.**

---

## 6. Guardrails de métricas derivadas

22. **Una métrica derivada no puede considerarse más fresca que sus inputs materiales.**
23. **Una salida no debe recibir reliability alta si una dependencia crítica tiene reliability baja.**
24. **Una métrica derivada sin lineage suficiente no debe usarse como evidencia de máxima confianza.**

---

## 7. Guardrails de atribución

25. **Platform self-attribution no representa automáticamente causalidad ni revenue incremental.**
26. **No sumar revenues atribuidos por varias plataformas como total de negocio.**
27. **Una caída de conversiones observadas no implica necesariamente caída de conversiones reales cuando han cambiado consentimiento, navegador, píxel o tracking.**
28. **Cuando backend y plataformas de ads divergen, investigar primero attribution/tracking antes de declarar deterioro empresarial.**

---

## 8. Guardrails de evidencia y estadística

29. **No emitir conclusiones de alta precisión a partir de datos altamente muestreados sin advertencia.**
30. **No convertir variaciones con muestra muy pequeña en evidencia fuerte.**
31. **Marcar `LOW_SAMPLE`, `HIGH_VARIANCE` o `INSUFFICIENT_OBSERVATIONS` cuando sean materiales.**
32. **No convertir evidencia cualitativa en porcentaje de usuarios afectados sin denominador válido.**
33. **La evidencia humana debe distinguirse de la evidencia instrumentada.**

---

## 9. Guardrails de salida diagnóstica

34. **No forzar una causa empresarial cuando D1 detecta un problema de datos material.**
35. **Degradar confidence cuando los datos son correctos pero insuficientes para confirmar la causa.**
36. **Bloquear o degradar diagnósticos downstream cuando la fuente necesaria falla materialmente.**
37. **Declarar el `data_gap` que impide confirmar una hipótesis.**
38. **Distinguir siempre entre señal compatible con una hipótesis y causa confirmada.**

---

## 10. Casos que requieren prioridad técnica

Debe priorizarse una investigación técnica antes que una interpretación empresarial cuando exista una combinación como:

- caída abrupta de eventos coincidente con un despliegue de tracking;
- analytics cae pero pedidos/pagos permanecen estables;
- analytics crece de forma extrema pero backend permanece estable;
- fuente parcial por permisos, rate limits o sync incompleto;
- discrepancia causada por timezone o ventanas temporales no equivalentes;
- cambio conocido de definición o atribución;
- spike coincidente con historical backfill.
