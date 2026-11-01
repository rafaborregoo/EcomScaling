# F9.2 · Recuperación de jobs y sincronizaciones parciales

Fecha: 2026-10-21. Implementación local; sin despliegue.

## Cambio

La cola Shopify ya estaba configurada para cinco intentos con espera exponencial desde un minuto. El fallo era que la sincronización podía registrar bloques fallidos, poner la conexión en error y aun así devolver un resultado normal. BullMQ interpretaba ese resultado como trabajo completado y no reintentaba.

Ahora, tras guardar y registrar un fallo parcial, `runShopifyInitialSync` lanza un error cuando algún bloque puede recuperarse. El worker agota la política existente de hasta cinco intentos y conserva el fallo final en la cola y en la conexión. Si los bloques fallidos indican que hacen falta permisos o reautorización, conserva el estado de error legible para el usuario y finaliza el job sin repetir la misma petición.

Los errores de base de datos al marcar la conexión como `syncing`, `error` o `connected`, o al finalizar una fila `integration_sync_runs`, también propagan un fallo. Así el worker no oculta que el estado no se pudo guardar. Las escrituras de los bloques sincronizados ya usan upsert y se mantienen las claves idempotentes que evitan repetir un import inicial ya completado.

## Verificación y límites

- Typecheck API completo: correcto.
- No se ejecutaron pruebas automatizadas ni una sincronización contra Shopify real en este bloque.
- No se añadió migración. El número de intentos, la espera exponencial, las claves idempotentes y el historial de cola existentes se conservan.
- Los reintentos vuelven a ejecutar la sincronización y pueden volver a leer bloques que ya habían terminado; los upserts evitan duplicar filas. La sincronización se considera completa solo cuando no quedan fallos recuperables.
- Los errores permanentes distintos de autorización aún pueden consumir los cinco intentos antes de quedar en estado fallido. La política fina de clasificación por código de error queda para una iteración posterior si la telemetría muestra ruido.
- Los trabajos cron ejecutados por el runner del VPS siguen registrando su código final en logs; esta entrega mejora el retry de la cola Shopify y no añade alertas de cron.
- No hace falta una acción en Shopify, Meta o Klaviyo. La prueba live de Shopify y el despliegue se reservan a la liberación final.

F9.3 continúa con compilación integral, accesibilidad y carga.
