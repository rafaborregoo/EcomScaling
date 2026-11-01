# Cierre F3 — reposición y A06 por escenario comercial

Fecha: 2026-10-20  
Estado: completada en local; no desplegada.

## Resultado

A06 ya recibe, por producto, un escenario calculado al ritmo base observado: unidades estimadas para Black Friday, unidades estimadas 30 días después y fecha estimada de agotamiento cuando ocurre antes de esas fechas. El cálculo se omite si el inventario no está sincronizado, el stock es desconocido, la demanda no supera la muestra mínima o la velocidad observada no permite estimar consumo.

El contexto deja explícito que estas cifras son una proyección de línea base, sin incremento de campaña. A06 puede recomendar revisar la reposición antes del evento, pero no debe inventar el efecto de un descuento, un stock mínimo ni una cantidad de compra. Para calcular cantidades de compra aún faltan plazos de proveedor, stock de seguridad y restricciones de pedido por producto.

## Trazabilidad, caducidad y aprobación

- La previsión usa la media diaria derivada del periodo observado, que exige al menos 14 días, 5 unidades vendidas y 3 días con ventas.
- La lectura de inventario debe ser `tracked_current` y tener menos de 48 horas; el cálculo incluye la fecha objetivo, días hasta ella y unidades proyectadas.
- Se conserva la fecha de agotamiento para que el agente pueda explicar «quedan N unidades ahora; al ritmo actual se agotan el D/M, antes de Black Friday» con cifras calculadas, no con texto libre.
- El diagnóstico cacheado vence a las 24 horas (`DIAGNOSTIC_STALE_AFTER_MS`). Al materializar una propuesta de reposición, la API ejecuta `validate_a06_restock_evidence`: comprueba stock actual, demanda observada, estado sincronizado y lectura de menos de 48 horas. Si la evidencia cambió o no está disponible, omite la tarea.
- La validación y el claim atómico ya estaban implementados en la migración `20261228100000_a06_risk_sample_and_atomic_restock.sql`; no hizo falta una migración nueva, por lo que no hubo cambios que aplicar en TEST ni producción.

## Verificación

- `npm run typecheck --workspace=@e-nora/api` — correcto.
- `npx tsx --test --test-force-exit apps/api/src/stock-forecast.test.ts` — 7 pruebas correctas. Incluye escenarios deterministas de proyección, rechazo de stock antiguo/muestra inmadura y holdout sintético: 8 semanas de historia pronostican las siguientes 4 semanas sin filtración de datos futuros.
- El holdout es determinista y sintético; no sustituye una validación retrospectiva sobre ventas reales de clientes. Esa medición requiere comparar previsiones guardadas con ventas futuras observadas a lo largo del tiempo.
- `git diff --check` no detecta errores de whitespace; Git solo avisa de la conversión de fin de línea CRLF habitual del workspace.

## Cambios

- `apps/api/src/stock-risk-evidence.ts`: proyección determinista con puertas de calidad y frescura.
- `apps/api/src/ai-runtime.ts`: entrega escenarios comerciales a A06 y refuerza el lenguaje de línea base y mínimos configurados.
- `apps/api/src/stock-forecast.test.ts`: ejemplos, límites de frescura y holdout.

No hay pasos manuales en Shopify, Meta o Klaviyo para esta fase. El código sigue local; el despliegue se mantiene para el final del plan.
