# A05: operación y continuidad de email

Fecha: 31/10/2026. Cuenta TEST: Prueba Borrego / E-NORA Demo.

## Hallazgos

La versión activa solo concedía `search_knowledge` (además de las herramientas automáticas del runtime). El contexto inicial aportaba métricas históricas, muestras de emails maduros, flows y acciones futuras de NORA. Omitía el inventario operativo de campañas puntuales de Klaviyo y los borradores de email de NORA; el calendario futuro tampoco cubría bien pendientes con fechas pasadas.

La simulación CLI de dos meses anterior no ejecutó herramientas. Su abstención no valida la capacidad del agente para investigar pendientes ni basta para cerrar su evaluación estratégica. El modelo primario sigue siendo Sol en la configuración de modelos del producto; esta revisión no cambia la selección.

## Cambios implementados

- Nueva herramienta de lectura `get_email_campaign_pipeline`, disponible también como contexto inicial de A05. Usa la misma función y fija organización y tienda en el servidor. Incluye campañas y mensajes sincronizados, estados, fechas, pendientes visibles de NORA, borradores de email y listas/segmentos agregados.
- Distingue enviada, enviándose, programada, fecha de programación pasada por verificar, borrador y cancelada. Un borrador con fecha pasada no equivale a un envío fallido; un mensaje enviado no completa una campaña que aún tiene otro pendiente. La planificación interna tampoco acredita envío externo.
- Recupera solo calendario visible al cliente, omite el texto de motivos de bloqueo y no admite parámetros de organización/tienda controlados por el modelo. Los borradores se filtran por tienda/connection y canal `email_klaviyo`.
- Concede herramientas existentes de rendimiento agregado/por entidad, medición, entregabilidad, contenido observado, catálogo, marca y organización. La migración agrega lecturas y conserva modelo, prompt y aprobación. Aplicada en TEST y producción; el código nuevo debe desplegarse para disponer de la nueva herramienta en producción.
- Instrucción de runtime: evaluar continuidad útil, contenido educativo, uso/cuidado, marca y posventa antes de abstenerse. Stock de un producto, margen de una oferta y medición de ingresos tienen alcances distintos; no bloquean automáticamente todo el email. Permite planificación condicional sin afirmar consentimiento, URL, descuento o inventario no verificados.
- Obliga a contrastar el backlog, no duplicar envíos existentes, explicar cadencia por audiencia y separar planificación de disponibilidad para enviar. Un bloqueo comprobado de todo el canal puede justificar abstención.
- La UI ya no interpreta automáticamente cero acciones nuevas como una recomendación de suspender todos los envíos. Conserva el diagnóstico real del modelo.

## Verificación

El inspector `scripts/a05-inspect-email-pipeline.mts` usa TEST y consulta el mismo módulo del runtime. Encontró 15 campañas totales de Klaviyo, 14 con email (13 borradores y 1 enviada), 7 borradores de email NORA, 2 elementos visibles de calendario, 4 listas y 9 segmentos. No son cantidades sumables: hay canales distintos y pueden existir vínculos o duplicados entre NORA/Klaviyo. La consulta no tuvo errores ni truncamiento en esta muestra. Los tamaños de audiencia faltan en varias filas y no acreditan consentimiento.

El inspector también comprueba que una tienda inexistente no cae en datos de organización y que `buildAgentTools` declara las herramientas de la configuración activa. Se añadieron pruebas para estados de envío y para impedir scope elegido por el modelo.

Resultado: 15 pruebas focalizadas correctas; build de AI y typecheck API/web correctos. API local reiniciada con health HTTP 200. No se ha desplegado el código a producción durante esta revisión.

## Límites y evaluación pendiente

El inventario procede de tablas sincronizadas, no del proveedor en vivo. No dispone de la cola de destinatarios individuales de flows, exposición por perfil, solapamiento real o una estimación de destinatarios consentidos. No debe decir que midió fatiga o que aplicó Smart Sending. Esas capacidades requieren datos y adaptadores adicionales, no otra instrucción al modelo.

No se ha generado una respuesta nueva del modelo en esta revisión. La UI conserva la simulación anterior con su procedencia y fecha; no se ha modificado su JSON para fabricar campañas. La próxima evaluación debe usar este contexto ampliado y registrar por separado la selección/ejecución real de herramientas y la simulación CLI. A05 queda reabierto hasta revisar su nueva planificación en laboratorio y en las vistas del producto.

Referencias de producto: [calendario Klaviyo](https://help.klaviyo.com/hc/en-us/articles/14719736311067), [cadencia por interacción](https://help.klaviyo.com/hc/en-us/articles/360037527052), [Smart Sending](https://help.klaviyo.com/hc/en-us/articles/115002779311).
