# RB-002 - Token OAuth de Shopify expirado o revocado

## Sintoma

`integration_connections.status = 'error'` con `metadata` indicando reautorización necesaria, o el sync
falla repetidamente con `shopify_reauthorization_required`/`shopify_connection_not_active` en
`integration_sync_runs.error_message`.

## Impacto

Ningún dato nuevo entra para esa tienda (ni sync ni webhooks efectivos) hasta reconectar. El resto de
tiendas de la organización no se ve afectado.

## Severidad

**SEV-3** (aislado a una tienda, con workaround claro: reconectar).

## Comprobaciones iniciales

1. Confirmar el motivo exacto guardado por `markConnectionNeedsReauth`
   (`apps/api/src/shopify-token-store.ts`):
   ```sql
   select id, status, metadata from integration_connections where id = '<connection_id>';
   ```
   `metadata` incluye el motivo textual (token sin expiración registrada = formato antiguo, refresh_token
   ya no utilizable, etc.).

2. Confirmar si el token sigue siendo válido en Shopify (a veces la revocación es del lado de Shopify,
   p. ej. el comerciante desinstaló y reinstaló la app, o cambió el plan de la tienda).

## Diagnóstico

`getValidShopifyAccessToken` (`shopify-token-store.ts`) ya renueva proactivamente con un buffer de 2 min
antes de expirar, y usa un claim (`refresh_locked_at`) para que dos procesos no refresquen a la vez. Si
llegó a este estado es porque:

- El `refresh_token` mismo ya no es válido (revocado por el comerciante, o la app fue desinstalada) — no
  hay refresco posible, hace falta reconexión completa (nuevo OAuth).
- Token guardado en formato antiguo sin `expires_at` (previo al fix de tokens expiring, commit `69e78f4`)
  — tampoco hay refresh_token utilizable, misma solución: reconectar.

No hay ambigüedad real que investigar más allá de esto: si `getValidShopifyAccessToken` lanzó
`shopify_reauthorization_required`, la única salida es una reconexión OAuth nueva.

## Acciones

1. Confirmar con el cliente/consultor que la tienda sigue existiendo y accesible en Shopify Admin.
2. Iniciar el flujo de conexión de nuevo desde `/integraciones` (mismo flujo que una conexión nueva —
   `createShopifyConnectionAuthUrl`/`handleShopifyOAuthCallback`, `shopify.ts`). No hace falta borrar la
   conexión existente antes: el callback OAuth actualiza la fila existente por `provider_account_id`.
3. Tras reconectar, disparar un sync manual (`POST /v1/organizations/:organizationId/shopify/sync`) para
   no esperar al cron de las 2am.

## Rollback

No aplica — reconectar no es una operación destructiva sobre datos ya sincronizados.

## Validación de recuperación

- `integration_connections.status = 'connected'`.
- Un sync manual completa con `succeeded` en los 4 bloques.

## Comunicación al cliente

Si la tienda estuvo desconectada más de un día, avisar de que hubo una ventana sin datos nuevos antes de
que se note por una discrepancia.

## Escalado

Si la reconexión OAuth falla repetidamente (no solo el refresh), es un problema distinto —
credenciales de la app (`SHOPIFY_API_SECRET`/`SHOPIFY_CUSTOM_API_SECRET`) mal configuradas o el modo de
distribución equivocado (ver ADR-0011). No seguir reintentando OAuth sin revisar el entorno del servidor.

## Evidencias a conservar

El `metadata.reason` guardado en el momento de marcar la conexión para reautorización, y la fecha en la
que se detectó (para saber cuánto tiempo estuvo la tienda sin sincronizar).

## Corrección vigente 2026-08-24

La referencia histórica a la ausencia de alerta queda supersedida: `ops-health-check.yml`
detecta tokens expirados o próximos a expirar y abre/actualiza el issue operativo correspondiente.

## Prevención

Ninguna automática hoy más allá del refresh proactivo ya implementado — no hay alerta que avise
activamente cuando una conexión entra en este estado (ver SQO-02; la alerta de "token próximo a
expirar"/"reauthorization_required").
