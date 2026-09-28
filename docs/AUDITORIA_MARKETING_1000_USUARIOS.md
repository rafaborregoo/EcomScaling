# Auditoría del módulo Marketing: escala y experiencia

Fecha: 25/09/2026  
Alcance: vistas cliente y consultor en la aplicación, biblioteca de plantillas, API de borradores, sincronización/atribución Klaviyo y generación de mailings. Revisión estática del código y esquema; no se ejecutó una prueba de carga ni una sesión autenticada de navegador.

## Conclusión ejecutiva

El módulo tiene separación funcional útil —Plan, Contenido, Crear y Rendimiento—, pero no se debe interpretar como validado para 1.000 usuarios concurrentes. La lectura y la biblioteca ya tienen protecciones parciales (límite de 50 en borradores, autorización por organización, RLS, y paginación ligera nueva para plantillas). Los mayores riesgos restantes están en el coste de IA y las operaciones largas: hay límites de generación compartidos por organización, la secuencia hace llamadas síncronas una detrás de otra y un fallo a mitad puede dejar borradores parciales. Para una publicación con carga real se necesitan métricas de producción y una prueba de concurrencia.

## Hallazgos por impacto

| Impacto | Hallazgo y evidencia | Estado |
| --- | --- | --- |
| Alto | El planificador genera el plan A27 por HTTP y después crea cada email con A11 secuencialmente; cada borrador tiene además su llamada de programación. La petición del navegador admite hasta 180 s. Un fallo en el email 4 de 7 conserva los tres anteriores y obliga a recuperarse manualmente. | Abierto: mover el flujo a trabajos durables con estados, idempotencia, reintentos y reanudación. |
| Alto | Los endpoints IA permiten 10 solicitudes/minuto con clave por organización. En un espacio compartido, un miembro consume el cupo de todos; al mismo tiempo, 1.000 usuarios legítimos generan 429. El límite es una protección de coste, no capacidad validada. | Abierto: definir cuotas por organización/usuario y cola con feedback, capacidad según presupuesto de IA. |
| Alto | Redis para rate limit solo se crea si existe `REDIS_URL`; el fallback es memoria del proceso. En múltiples réplicas/serverless no es un contador global ni una protección fiable de presupuesto. | Abierto: Redis compartido obligatorio en producción y alertas de cuota/disponibilidad. |
| Alto | La vista normal de borradores devuelve hasta 50 filas con HTML, texto y bloques completos, aunque el usuario solo consulte Plan o la primera vista de Contenido. El caché de 30 s vive dentro de cada pestaña; no deduplica entre 1.000 navegadores. | Parcial: la biblioteca nueva usa página de 50 y omite cuerpo HTML/texto/bloques; sus métricas se piden solo para los IDs de Klaviyo de esa página. Abierto: hacer ligeros también el listado general y la carga de detalle bajo demanda. |
| Alto | La vista global de consultor devuelve hasta 300 borradores con HTML y texto completo, sin paginación; el hilo antes consultaba todas las notas de todas las organizaciones accesibles. | Parcial: notas/hilos ahora se limitan a los 300 borradores cargados. Abierto: cursor de cartera y detalle bajo demanda; hoy el tope 300 puede ocultar piezas antiguas y el primer payload sigue siendo grande. |
| Alto | Las plantillas dependían del límite de 50 borradores recientes; una plantilla antigua desaparecía de la biblioteca. | Corregido: endpoint paginado por cursor estable y carga bajo demanda al abrir la biblioteca. |
| Alto | Klaviyo guarda informes por campaña/flujo mientras el sync necesita agrupar por mensaje; dos mensajes A/B colisionan en la clave de upsert y gana el último. Atribuir el resultado al template de toda la campaña era ambiguo. | Parcial, pendiente de aplicar la nueva migración: se excluyen campañas/flujos con más de un mensaje y solo se muestran métricas atribuibles sin mezclar monedas. Para atribución completa, guardar y consultar `campaign_message_id`/`flow_message_id` de extremo a extremo. |
| Alto | La biblioteca presentaba `count(*)` de snapshots mensuales como “envíos” y fijaba ingresos en EUR. | Corregido en el contrato SQL nuevo, pendiente de aplicar en la BD: se muestra número de entidades medidas, no envíos; se ocultan ingresos si hay moneda mixta o desconocida y se formatea la moneda devuelta. Mientras tanto, la UI oculta las métricas con contrato antiguo. |
| Medio | La consulta de rendimiento une reportes por organización y entidad. Con mucha historia puede ser costosa si se recalcula para cada página. | Parcial: ya no se ejecuta al abrir la vista general; la biblioteca envía solo IDs de plantillas de la página, tiene índice compuesto por organización/tipo/ID/periodo y se excluyen históricos ambiguos. Medir `EXPLAIN (ANALYZE, BUFFERS)` con cardinalidad productiva antes de afinar. |
| Medio | Cada llamada a A27 carga varios bloques de contexto en paralelo (informes, cobertura, borradores, calendario e historial de agentes). Son consultas justificadas, pero aumentan picos y latencia al generar masivamente. | Abierto: observar tiempos por bloque, limitar/compactar contexto y reutilizar resúmenes frescos cuando la semántica permita cachearlos. |
| Medio | Las plantillas importadas sin diseño de bloques no se ofrecían al planificador, aunque tenían perfil de diseño; además el banco de imágenes podía consultarse con el modal cerrado. | Corregido: el planificador recorre el catálogo con cursor, filtra opciones sin diseño ni ficha analizada y solo consulta el banco al abrirse. La plantilla con diseño editable se usa como `base_design`; las fichas elegidas se envían a A11. |
| Medio | La biblioteca no ofrecía búsqueda, filtros ni jerarquía legible; métricas, estado y paleta competían por atención. | Corregido: búsqueda/filtros, origen y estado explícitos, ficha de métricas alineada, paleta compacta, tamaños de texto mayores y estados accesibles. |

## Experiencia visual revisada

La biblioteca pasa a ser una superficie de trabajo compacta, no una sucesión de tarjetas: nombre y origen primero, badge de análisis y estado de envío después, paleta como señal secundaria y métricas alineadas en una columna independiente. Se añadieron controles de búsqueda/filtro, estados de carga/error/vacío, carga de anteriores, foco visible y etiquetas accesibles. El contenido se carga al abrir la biblioteca y en páginas de 50, sin traer el cuerpo creativo de cada email.

La estructura global ya separa Plan, Contenido, Crear y Rendimiento, así que no conviene volver a apilar el módulo entero en una sola pantalla. La siguiente iteración estética debería revisar cada sección en navegador con datos reales y simplificar solo las tarjetas redundantes: no eliminar paneles que representan decisiones, rendimiento o estado operativo distintos.

## Requisitos antes de declarar capacidad para 1.000 usuarios

1. Ejecutar una prueba con escenarios separados de lectura (apertura de módulo y páginas de biblioteca), edición/aprobación y generación de 1/3/7 emails; subir concurrencia gradualmente hasta 1.000 sesiones, no disparar 1.000 generaciones al mismo tiempo sin presupuesto aprobado.
2. Registrar p50/p95/p99 por endpoint, tamaño de respuesta, errores/429, conexiones y CPU de API, saturación y consultas lentas de Postgres, uso/memoria de Redis, latencia/coste del proveedor IA y trabajos parciales.
3. Probar dos organizaciones con muchos usuarios para detectar aislamiento cruzado, concurrencia sobre el mismo borrador, doble envío/reintento y cursores de paginación en timestamps iguales.
4. Decidir objetivos de servicio y coste antes de fijar cuotas. Como valores iniciales a debatir: lectura p95 < 1,5 s, error de lectura < 1%, generación aceptada en menos de 2 s con estado durable y resultados visibles cuando cada paso termina. Son propuestas de aceptación, no mediciones actuales.
5. Validar el resultado visual con navegador en cliente y consultor, desktop/móvil, teclado y datos largos; esta revisión no pudo verificar renderizado autenticado.

## Trabajo prioritario recomendado

1. Introducir `marketing_generation_jobs` (o cola equivalente) con idempotency key, dueño/organización, progreso por pieza, errores parciales, reintentos con límite y cancelación; responder `202 Accepted` y hacer polling/SSE.
2. Migrar lectura de borradores a resumen paginado y endpoint de detalle, manteniendo aislamiento RLS; no descargar HTML de 50 piezas al abrir Marketing.
3. Persistir los IDs de mensaje en filas de reporting y atribuir cada métrica al mensaje/template correcto, incluyendo campañas A/B y mensajes de flow.
4. Exigir Redis compartido para rate limiting en producción y hacer visible al usuario cuándo está esperando cuota, en lugar de dejar un `429` sin guía.
5. Ejecutar carga representativa y ajustar índices/cuotas a partir de trazas y planes reales.
