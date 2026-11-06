# A17 · Plan semanal · 6 de noviembre de 2026

Cuenta TEST: borregorafa99@gmail.com; consultor rafael@noraapp.es. Organización SnowBorrego (slug prueba-borrego), tienda E-NORA Demo. Comparación por CLI, sin API pagada, Astra, cambios en Shopify/Meta/Klaviyo ni tareas creadas automáticamente.

## Función y ejecución

A17 propone entregables para los próximos siete días. Usa el Camino, las tareas abiertas, decisiones y resultados anteriores, alertas, especialistas y ventas de la tienda. No sustituye A04 (diario) ni A18 (mensual). Una propuesta pendiente no equivale a una tarea aprobada. Cero propuestas puede ser correcto cuando ya existe trabajo equivalente.

El cron comprueba elegibilidad cada doce horas y respeta presupuestos, topes, actividad y antigüedad mínima. La referencia es una generación cada seis días por tienda: unas cinco en treinta días. Cliente y consultor comparten la misma lectura; abrir ambas cuentas no duplica llamadas. Las regeneraciones manuales, herramientas, juez, reintentos y fallback pueden sumar coste.

## Defectos corregidos antes del veredicto

- El cron generaba un agregado organizativo y enviaba connectionId=null; la UI consultaba la tienda. Ahora programa y ejecuta A17 por tienda.
- A17 excluía ventas del periodo anterior. Ahora conserva la comparación de treinta días y añade dos semanas completas consecutivas de siete días, con extremos UTC explícitos, más el acumulado del mes calendario hasta el corte. No mezcla ese acumulado con los treinta días móviles ni compara un periodo parcial con otro completo.
- El backlog resumido omitía títulos y no exponía el UUID del Camino. Se conserva un índice de todos los títulos consultados y se aporta el plan_id desde su tabla, sin copiarlo de otra respuesta de IA.
- La capacidad solo se calculaba para A18. A17 recibe compromisos para siete días, con horas disponibles desconocidas; el conteo de tareas no demuestra saturación horaria.
- La respuesta semanal eliminaba answer; ahora mantiene una explicación legible.
- Tareas no mostraba A17 y llamaba «esta semana» a A04. A04 se etiqueta «hoy»; A17 tiene su propia sección compartida, con límites del análisis visibles.
- Una lectura semanal sin escrituras ya no queda pendiente de aprobación por defecto. Las propuestas de tareas sí requieren revisión.

## Tandas y trazabilidad

La primera tanda, `a17_plan_semanal:real-store-runtime-2026-11-06`, conserva seis respuestas pero queda excluida del veredicto: faltaban ventanas semanales, acumulado mensual, índice completo y plan_id. Es un hallazgo del backend, no un fallo atribuible al modelo.

La tanda corregida es `a17_plan_semanal:real-store-runtime-2026-11-06-weekly-v2`. Mismo snapshot, prompt activo y contrato JSON nativo para Haiku 5.5, Sonnet 5.5, Opus 5.5, GPT-6 Luna, GPT-6.1 Sol y GPT-6.1 Terra. Son datos persistidos de demostración, no resultados de una tienda comercial real. El hook beforeModel captura el contexto y detiene el runtime antes de la llamada pagada. Las CLI no ejecutan herramientas dinámicas: este ensayo evalúa lectura y planificación sobre el snapshot, no la corrección de nuevas consultas o integraciones.

La semana [30/10, 06/11) UTC contiene 9.954,70 EUR netos y 192 pedidos; [23/10, 30/10), 11.505,60 EUR y 222 pedidos. El acumulado mensual es 6.941,10 EUR hasta el corte. Hay 72 tareas abiertas. Estas cifras no demuestran una causa de la caída ni equivalen a capacidad laboral disponible.

Sol y Opus agotaron los 300 segundos del primer intento de la tanda corregida sin recibo final. Se reintentan solo esos modelos con 600 segundos. Recibo preservado en `.e-nora-test-lab/a17-real-2026-11-06/timeouts-first-attempt.json`; el consumo de esos intentos incompletos es desconocido.

## Revisión y visibilidad

**Sonnet 5.5 principal y GPT-6.1 Terra fallback**, fijados en política compartida, runtime, Costes y Laboratorio. La versión activa TEST registra Sonnet y los overrides usan la política por defecto. La cadencia usa 1/6, evitando el redondeo SQL a 0,17.

| Modelo | Contrato | Tiempo completo | USD/run en frío | USD/30 días, 5 runs |
| --- | --- | ---: | ---: | ---: |
| Haiku 5.5 | Válido | 123 s | 0,0774 conservador | 0,3871 |
| Sonnet 5.5 | Válido; principal | 14,7 s | 0,1378 | 0,6889 |
| Opus 5.5 | Inválido: due_hint >100 | 355,9 s tras timeout | 0,9587 | 4,7934 |
| GPT-6 Luna | Válido | 17,1 s | 0,0058 | 0,0289 |
| GPT-6.1 Sol | Válido | 324,5 s tras timeout | 0,1259 | 0,6296 |
| GPT-6.1 Terra | Válido; fallback | 19,4 s | 0,0628 | 0,3141 |

Excluyen consumo desconocido de intentos incompletos. Haiku/Opus acumulan varias entradas en su recibo: la cota en frío sobre el agregado no equivale a una única llamada; el tramo largo de Haiku resulta conservador.

Sonnet expone cifras, hitos vigentes y tarea de invierno vencida; cero tareas nuevas resulta defendible. Su referencia a seis días incluye una jornada parcial: no extrapolar como seis días completos. Terra conserva cifras y prudencia, pero destaca menos la prioridad vencida. Sol no mejora la utilidad y fue mucho más lento. Luna omite cifras y límites. Haiku aparta la meta del trabajo semanal con excesiva rigidez. Opus añade dos ideas revisables: comprobación conjunta de Black Friday y prueba de carrito. No se penaliza su cantidad, pero la salida incumple el contrato; no se recorta su plazo para declararla válida.

La comparación se consulta en Platform Admin → Laboratorio IA → A17, con precios, observaciones y respuestas originales. La lectura elegida está en **Tareas → A17 · Plan semanal**, `/tareas#plan-semanal`, para cliente y consultor con E-NORA Demo seleccionada. No se crean tareas automáticamente.

Run guardado `8cc24c21-75fd-4fda-83bb-357d21b83e7b`, output `b0d4ef8a-4d5a-4175-bea7-c87248e69584`, shadow CLI sin coste facturado inventado. Dos sesiones reales independientes reciben idéntico resultado publicado sin aprobación al no proponer escrituras. HTTP Tareas, Costes y Laboratorio responde 200; recibos en `.e-nora-test-lab/a17-real-2026-11-06/`. No se declara revisión visual autenticada del navegador.

32 pruebas de autorización, alcance, ventanas, capacidad, índice y modelo correctas. Serialización de 141.730 caracteres sin truncar bloques con la política A17. Sin migración nueva ni cambios de producción.

Typecheck API y web correctos, tras reconstruir los contratos compartidos. ESLint de los cambios sin errores; las pantallas compartidas Tareas/diagnóstico conservan nueve advertencias anteriores sobre efectos, imágenes y símbolos sin uso.

Los precios se calculan como equivalente API en frío con el catálogo local del 28/10/2026 y los tokens declarados por las CLI. Incluyen sobrecarga de CLI y no son facturas ni tarifas actuales verificadas. Una sola tienda y un solo snapshot no prueban superioridad general; Codex no confirma el ID exacto servido.
