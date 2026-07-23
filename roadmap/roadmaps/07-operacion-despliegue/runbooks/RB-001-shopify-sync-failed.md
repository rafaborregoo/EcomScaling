# RB-001 - Sync de Shopify fallido o desactualizado

## Sintoma

Un cliente reporta "los pedidos/productos/stock de [tienda] no están actualizados" o el panel de
Configuración muestra una conexión Shopify en `error`.

## Impacto

El dashboard, las métricas financieras y los diagnósticos IA (A02/A04/A06) de esa tienda quedan basados en
datos obsoletos sin avisar explícitamente más allá del badge de estado — riesgo de que el consultor tome
decisiones sobre cifras viejas.

## Severidad

- **SEV-2** si afecta a una sola tienda con datos parados >2h.
- **SEV-1** si afecta a varias tiendas simultáneamente (probable fallo de plataforma, no de una tienda).

## Comprobaciones iniciales

1. Estado de la conexión:
   ```sql
   select id, organization_id, provider_account_id, status, updated_at
   from integration_connections
   where provider = 'shopify' and provider_account_id = '<shop>.myshopify.com';
   ```
   - `error`: el último intento falló, ver `error_message` en `integration_sync_runs` (paso 2).
   - `syncing` con `updated_at` de hace horas: probablemente atascada (el sync inicial corre en una
     función serverless de duración corta y puede morir a mitad de un bulk operation).
   - `disconnected`/`revoked`: la tienda se desconectó (posible desinstalación real, ver RB-010 si existe,
     o token revocado, ver RB-002).

2. Últimas corridas de sync por bloque (`catalog`/`inventory`/`orders`/`refunds`):
   ```sql
   select sync_type, sync_scope, status, error_code, error_message, started_at, finished_at, attempt_count
   from integration_sync_runs
   where connection_id = '<connection_id>'
   order by created_at desc
   limit 20;
   ```

3. Webhooks recientes de esa tienda (para saber si el problema es de sync inicial/reconciliación o de
   webhooks en tiempo real):
   ```sql
   select topic, status, received_at, processed_at, error_message
   from private.webhook_events
   where connection_id = '<connection_id>'
   order by received_at desc
   limit 20;
   ```

## Diagnóstico

- **`error_code`/`error_message` de `integration_sync_runs` apunta a Shopify** (rate limit, GraphQL error,
  bulk operation cancelado): ver `apps/api/src/shopify-bulk.ts`/`shopify-sync.ts`. Reintentable —
  la reconciliación diaria (cron `0 2 * * *` Europe/Madrid, `apps/worker/src/worker.ts`) debería
  recogerlo sola; si es urgente, forzar antes (ver Acciones).
- **Conexión en `error` por token**: ver RB-002 (token OAuth expirado/revocado).
- **`webhook_events` con `signature_valid: false` o vacío para esa tienda**: posible tienda instalada por
  la app custom cuya secret cambió — ver `SHOPIFY_CUSTOM_API_SECRET` en el entorno del servidor
  (`apps/api/src/shopify-webhook-handler.ts` prueba ambos secrets; si ninguno valida, es un problema de
  configuración de secrets, no de la tienda).
- **`syncing` atascado sin error**: la función serverless murió a mitad de camino. La reconciliación
  (`reconcileAllShopifyConnections`, `apps/api/src/shopify-reconcile.ts`) ya detecta conexiones en
  `syncing` con `updated_at` más viejo que `STALE_SYNCING_MS` y las reintenta automáticamente en el
  siguiente pase — si el cron de las 2am aún no ha corrido, se puede esperar o forzar manualmente.

## Acciones

1. **Reintento manual sin esperar al cron**: llamar `reconcileAllShopifyConnections(env)` (mismo código
   que usa el cron) o, si solo es una tienda, disparar sync desde el endpoint existente
   (`POST /v1/organizations/:organizationId/shopify/sync`, ver `shopify.ts`/`server.ts`).
2. Si el error persiste tras un reintento limpio, revisar si es un problema de la API de Shopify (estado
   de servicio de Shopify) antes de asumir un bug propio.
3. Si el token está expirado/revocado, seguir RB-002 antes de reintentar el sync (reintentar sin token
   válido solo genera más ruido en `integration_sync_runs`).

## Rollback

No aplica en el sentido de deshacer cambios — el sync es idempotente (upsert por `external_*_id`, nunca
append-only, ver `docs/decisions/ADR-0006-integration-module-pattern.md`). Reintentar no duplica datos.

## Validación de recuperación

- `integration_connections.status = 'connected'`.
- La corrida más reciente de `integration_sync_runs` para cada `sync_scope` tiene `status = 'succeeded'`
  y `finished_at` reciente.
- Comparar manualmente 2-3 pedidos/productos recientes contra el Admin de Shopify.

## Comunicación al cliente

Si el fallo duró más de 2h y afectó a datos visibles (dashboard, alertas basadas en stock/ventas), avisar
explícitamente al cliente de la ventana afectada — no dejar que lo descubra por su cuenta comparando
cifras.

## Escalado

Sin runbook de escalado formal todavía (equipo de una persona, ver R-018 en `RIESGOS.md`) — si no se
resuelve en 30 min siguiendo este runbook, es señal de que el problema es nuevo y hay que investigar en
código, no repetir estos pasos.

## Evidencias a conservar

`error_message`/`error_code` completos de `integration_sync_runs`, el rango de `webhook_events` afectado,
y el resultado del reintento manual (éxito/fallo) — para saber si el fix real fue "esperar" o si hizo
falta código.

## Prevención

Este runbook seguirá siendo manual (consultas SQL directas) hasta que exista un panel de salud por
conexión (SQO-02, `pendiente`) que muestre esto sin tener que consultar la base a mano.
