# A12 · analista de email · revisión de 2 de noviembre de 2026

Se selecciona **GPT-6.1 Sol** como principal, **Claude Sonnet 5.5** como fallback entre proveedores y **Terra** como alternativa económica. La política compartida fija el modelo en runtime y administración; no permite que una preferencia antigua del cliente o de plataforma sustituya esta decisión.

## Qué hace y dónde está

A12 interpreta el rendimiento mensual de Klaviyo: ingresos atribuidos, reparto campañas/flows, interacción y entregabilidad. Compara **octubre completo (1–31)** con **septiembre completo (1–30)**, no noviembre parcial. El resultado de la tienda es compartido por cliente y consultor. No hace una generación adicional por cada persona que lo lee. El agregado de organización tiene caché y ejecución distintos.

El propietario puede verlo en **Dashboard → Klaviyo → A12 · Analista de email**, `/dashboard?tab=klaviyo`, en la cuenta `borregorafa99@gmail.com`, tienda E-NORA Demo. El consultor `rafael@noraapp.es` obtiene exactamente la misma salida por esa tienda. El diagnóstico se lee sin aprobación; cualquier futura propuesta de tarea se revisa antes de materializarse.

Corrección posterior de ubicación: la navegación principal usa **Klaviyo → Resumen**, `/klaviyo#analisis-email`. A12 estaba en un acordeón exclusivo del consultor; ahora aparece arriba como **A12 · Rendimiento de email** para cliente y consultor, reutilizando el mismo resultado. El enlace del dashboard es una superficie adicional. No se afirma inspección visual: página HTTP 200 y comprobaciones de código/API.

Resultado seleccionado: run `d2727e2c-0ff9-4d3b-a9d8-8804afaef238`, output `f5577539-9021-4f08-8bd8-95721d746a68`. Cuatro hallazgos, dos recomendaciones y cero tareas propuestas; sin cambios en Klaviyo. Se normaliza `approval_required=false` porque no hay escrituras y se añade una advertencia explícita sobre datos sintéticos TEST. La respuesta original permanece en el informe y snapshot.

## Datos y fallo corregido

Se capturaron doce bloques del runtime con el informe, cobertura, moneda, tareas, plan, actividad, diagnósticos anteriores e historial de otros especialistas. **El contexto procede de la cuenta real TEST, pero los valores de rendimiento existentes son sintéticos**, escenario `enora_12m_v1`; no son resultados comerciales reales. No se crearon campañas, envíos ni cifras nuevas para esta revisión.

Los informes sintéticos tenían límites finales exclusivos: octubre terminaba el 1/11 y septiembre el 1/10. El sincronizador y el RPC usan fechas inclusivas; por eso el RPC descartaba ambos meses. Se corrigieron exclusivamente doce filas sintéticas de `klaviyo_report_values` y sus doce `klaviyo_report_runs` de esta organización TEST. El informe ahora devuelve una fila de campaña en cada mes. No se modificaron SQL, producción ni el sincronizador correcto. Copia previa: `.e-nora-test-lab/a12-real-2026-11-02/exclusive-month-fixture-backup.json`.

La primera tanda de seis respuestas, con cobertura ausente, queda como un caso separado. Tras corregir el fixture se capturó un snapshot nuevo y se ejecutaron otras seis respuestas, todas válidas en el contrato nativo. El arnés de captura también conserva los contadores agregados de emails (18 conocidos, 15 sin cuerpo), que el filtro genérico de datos personales ocultaba por el nombre de campo. No se relajó la protección de direcciones de correo ni credenciales.

## Comparación observada

| Modelo | Hallazgo principal de la revisión | USD por ejecución sin caché | 60 ejecuciones USD |
|---|---|---:|---:|
| Haiku 5.5 | Barato; infiere una causa de atribución por la casi coincidencia de dos importes y limpieza de lista sin evidencia | 0,0085683 | 0,514098 |
| Sonnet 5.5 | Buena estructura y confianza media; presenta demasiado firme el problema de flows antes de comprobar cobertura | 0,074544 | 4,47264 |
| Opus 5.5 | Comprobación detallada; afirma efectos de privacidad y acciones previas sin evidencia e introduce meta de 15 % no justificada | 0,274752 | 16,48512 |
| Luna | Muy barato y cifras útiles; confianza alta, fuente A26 no disponible citada y redondeo menor de crecimiento | 0,003812 | 0,22872 |
| **Sol** | Cifras y denominadores, cautela causal, confianza media y no duplicación; mejor equilibrio observado de fiabilidad | **0,09684** | **5,8104** |
| Terra | Alternativa de menor coste; confianza alta y comparación de una campaña con totales previos de otra entidad mensual | 0,045366 | 2,72196 |

Los seis reciben los mismos bloques y contrato. Haiku/Opus proponen una comprobación adicional de flows: **no se penaliza la cantidad de tareas**; se evalúa su evidencia, novedad y utilidad. Sol distingue el cero agregado del informe de la ausencia de filas de flows y no afirma que falten automatizaciones: bienvenida/carrito constan como completados. Los umbrales genéricos 25–35 % provienen del prompt, no de una meta económica validada de esta tienda.

Sol identifica ingresos atribuidos de 10.478,40 frente a 7.714,30 EUR (+35,83 %), mejora en ingresos por destinatario e interacción, y caída de bajas/rebotes. No atribuye estas mejoras al asunto ni presenta eventos de comportamiento como ventas incrementales. No hay entidades flow con rendimiento en este fixture, por lo que no se valida calidad numérica del análisis de flows.

La evaluación es retrospectiva por el asistente contra el snapshot, no un panel humano independiente ni una tasa estadística de precisión. Una muestra por modelo no demuestra superioridad universal. Codex no confirma el ID servido; Claude sí confirmó los tres IDs. No se evaluó llamada dinámica a herramientas ni API pagada.

## Frecuencia y coste mensual

El orquestador tiene dos ticks diarios, antigüedad base de veinte horas y comprobaciones de actividad/digest, propuestas pendientes, cupos y presupuesto. Para una organización con una tienda, los alcances son **tienda + agregado organizativo**. El perfil de Costes se corrige de una a dos ejecuciones diarias de diseño para representar ese fan-out; no se añade una ejecución por consultor.

- 30 lecturas de tienda: **2,9052 USD** con Sol.
- Otras 30 del agregado: escenario total **5,8104 USD**.
- Si no cambian datos/actividad o actúan los límites, se generan menos. Ajustes de cadencia, más tiendas, ejecuciones manuales, herramientas, fallback y reintentos cambian el gasto.

Son estimaciones de API sin asumir caché sobre tokens CLI, no facturas ni gasto garantizado. Las tarifas de referencia están en el calculador común del laboratorio. Las dos tandas y sus recibos se conservan; el coste de evaluación no se confunde con la proyección mensual de producción.

## Código, pruebas y evidencia

- Decisión: `packages/contracts/src/ai-model-decisions.ts` (`A12_MODEL_DECISION`).
- Perfil de costes y frecuencia: `apps/api/src/ai-cost-model.ts`, `apps/api/src/agent-schedule.ts`.
- Platform admin → Laboratorio IA: caso normalizado por defecto, seis salidas y notas; tarjeta con principal, fallback y costes. La cuenta cliente sigue usando la sección normal de Klaviyo.
- Scripts de captura, normalización TEST, revisión y publicación del diagnóstico: `scripts/a12-*.mts`.
- Evidencia: `.e-nora-test-lab/a12-real-2026-11-02/review.json`, `visibility.json`, y los dos casos en `.e-nora-test-lab/ai-models/report.json`.

Cinco pruebas focalizadas correctas: prioridad de modelo/política, override rechazado y coherencia de Costes, y conservación de señales de entregabilidad por flow. Verificación autenticada de los dos usuarios: mismo run/output, cuatro hallazgos, sin tareas, lectura inmediata y otra organización denegada. Página de Klaviyo HTTP 200. No se realizó inspección visual de navegador.

ESLint del laboratorio y typechecks API/web correctos. Al reconstruir contratos se detectó que el tipo manual duplicado de edición de propuestas divergía de su esquema compartido con `exactOptionalPropertyTypes`; ahora deriva del contrato, conservando compatibilidad con las prioridades históricas guardadas como texto. Las seis pruebas del guard de aprobación siguen correctas, sin cambiar reglas de permisos ni ejecución de propuestas.

Código aplicado localmente, sin despliegue remoto ni migraciones nuevas. La corrección de datos se limitó a TEST.
