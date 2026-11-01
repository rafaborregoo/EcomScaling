# Implementación de sincronización continua

Implementado en el código y aplicado a **TEST** (`kopcblejsxpkxoykldyh`). Producción no se ha modificado.

## Comportamiento

- Shopify: firma HMAC del cuerpo original, persistencia antes de responder, consumidor independiente,
  tandas de 100 eventos, recuperación cada 5 segundos, hasta 16 intentos con espera exponencial
  y recuperación de procesos interrumpidos. Reconciliación cada 15 minutos.
- Suscripciones Shopify: consulta paginada, recuperación de suscripciones borradas, actualización
  de la URL, comprobación horaria y salud persistida. La tienda TEST confirmó **16/16** suscripciones.
- Meta: cola propia, consultas recientes cada 10 minutos, datos estructurales y ventana ampliada
  cada hora y backfill diario. Los fallos parciales activan los reintentos; una aplicación eliminada
  se identifica como problema de autorización/configuración.
- Klaviyo: cola propia, consulta cada 15 minutos, informes recientes que se vuelven a consultar,
  backfill separado y errores de bloques visibles como sincronización parcial. Selección automática
  de `Placed Order` solo si hay una única métrica oficial de Shopify y todavía no existe selección.
  Los eventos creados por otras aplicaciones con el mismo nombre no se seleccionan.
- Webhooks de Klaviyo: alta y recuperación condicional, secretos cifrados, HMAC cuerpo+timestamp,
  protección frente a reenvíos antiguos, validación de cuenta/webhook y almacenamiento de identificadores
  sin los datos personales del evento. Si la cuenta no tiene acceso, continúa la consulta periódica.
- Navegador: una suscripción Realtime por portal, aislada por organización, recuperación al volver
  a la pestaña/reconectar y comprobación de respaldo cada 30 segundos. Invalida los recursos afectados
  y conserva el último resultado visible mientras carga el siguiente.
- Caché: revisiones por organización; una respuesta antigua no se considera actual después de un evento.
  La caché SWR conserva la última copia correcta mientras recalcula y comparte el cálculo entre peticiones.
- Base de datos: protección por fecha del proveedor para pedidos, líneas, descuentos e inventario;
  índice único y columna `updated_at` para repetir los upserts de audiencias; índices de cola y tabla `integration_changes` con RLS. Realtime publica
  exclusivamente un recibo acotado, sin OAuth, credenciales ni payloads.
- Operación: monitor de integraciones cada 5 minutos, estados pendientes/processing/failed incluidos,
  identificación de eventos con intentos agotados, cierres ordenados del worker y recuperación de trabajos.

## Verificación

- Compilación de API y worker y comprobación TypeScript de web.
- 92 pruebas de regresión dirigidas, tres casos HTTP de entrega en local y HTTPS y tres pruebas
  existentes de idempotencia contra TEST, adaptadas al acuse asíncrono. Cero errores de lint en
  los archivos web comprobados; quedan avisos previos de hooks.
- Pruebas de firmas, manipulación, replay, privacidad, suscripciones reparadas, ventanas de deduplicación,
  caché, feature flags, configuración y recuperación.
- Tres pruebas reales en TEST por HTTP local y las mismas tres por HTTPS público:
  rechazo de firma incorrecta, reintento de conexión aún inicializándose, duplicados, procesamiento por
  el worker real y evento antiguo que no altera pedido/líneas más recientes. Las organizaciones y pedidos
  de estas pruebas se eliminan al terminar.
- Prueba SQL transaccional con rollback: pedido, inventario y líneas más recientes prevalecen, hijos antiguos se ignoran,
  generación del recibo, actualización repetida de audiencias y aislamiento RLS entre organizaciones.
  La migración se reaplicó correctamente y una segunda sincronización real de Klaviyo guardó las audiencias.
- Medición de evento de prueba: respuesta **575 ms**, persistencia del pedido aplicado **3359 ms**.

La latencia intermitente ya documentada de Supabase TEST puede retrasar consultas agregadas del dashboard;
no constituye una garantía de latencia ni de disponibilidad 24/7. Ver
[diagnóstico de latencia](../LATENCIA_SUPABASE_TEST_2026-10-21.md).

## Desarrollo local y autorización final

`npm run dev:webhooks` abre un túnel de desarrollo que expone únicamente las rutas de webhooks y `/health`.
Guarda el origen HTTPS en `.env.local`; reiniciar API y worker si cambia. No publica el resto de la API.
El túnel deja de estar disponible al detener el proceso o apagar el ordenador.

Para reautorizar: abrir **Configuración → Integraciones** en el entorno deseado y reconectar Shopify,
Meta y Klaviyo. No hace falta compartir contraseñas con el agente. Klaviyo pedirá scopes de webhooks
solo cuando se habilite expresamente la función para una cuenta/aplicación que los soporte.
Si no hay una métrica oficial de compra inequívoca, seleccionar manualmente la métrica correcta.

## Pendiente fuera de local

1. Desplegar esta implementación y su migración en producción con el origen HTTPS estable y worker/Redis
   persistentes. Las credenciales existentes de producción requieren reautorización; Meta además informa
   de una aplicación eliminada y necesita una aplicación activa, no solo repetir el login.
2. Reautorizar las cuentas en ese entorno y confirmar una compra de prueba de Shopify en el dashboard.
3. Confirmar elegibilidad de Webhooks API de Klaviyo si se quiere activar recepción por eventos.
   La sincronización periódica ya funciona como alternativa y no exige contratar una ampliación.

El chequeo global de migraciones señala tres migraciones anteriores ajenas a este cambio y la guarda
de cobertura de tests señala cuatro archivos anteriores no incorporados a scripts. No se ha cambiado
su contenido ni se ha realizado un despliegue con esas guardas en rojo.
