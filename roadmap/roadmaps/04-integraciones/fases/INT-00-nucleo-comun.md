# INT-00 - Nucleo comun de integraciones

## Estado

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-04
- **Bloqueador:** ninguno
- **Evidencia:** `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql` (tablas
  `integration_connections`, `integration_sync_runs`, `private.webhook_events`),
  `apps/api/src/integrations.ts` (`GET /v1/organizations/:organizationId/integrations`).
- **Que existe:**
  - `integration_connections.status`: `pending | connected | syncing | error | disconnected | revoked`
    (constraint real en la migracion). No incluye `reauthorization_required` ni `degraded` como estados de
    DB — Shopify resuelve "reautorizacion necesaria" comparando scopes requeridos vs concedidos en tiempo
    de lectura, no como columna (ver INT-01).
  - `integration_sync_runs.status`: `queued | running | succeeded | failed | cancelled | retrying`.
  - `private.webhook_events.status`: `received | ignored_duplicate | queued | processed | failed`.
  - `provider` esta fijado por constraint en las tres tablas a
    `'shopify' | 'meta_ads' | 'klaviyo' | 'instagram' | 'fathom' | 'loom'` — el enum de proveedores ya
    cubre los seis conectores del roadmap, aunque solo Shopify y Meta tienen codigo.
  - Endpoint `GET /v1/organizations/:organizationId/integrations` agrega estado real de todas las
    conexiones sin exponer tokens ni payloads externos.
- **Que falta:**
  - No existe una interfaz de adaptador comun en codigo (`IntegrationAdapter` o equivalente). Shopify
    (`shopify.ts`, `shopify-oauth.ts`, `shopify-sync.ts`, `shopify-webhook-handler.ts`, ...) y Meta
    (`meta.ts`, `meta-oauth.ts`, `meta-sync.ts`) implementan el mismo patron de forma paralela pero sin un
    contrato compartido — cada conector nuevo (Klaviyo, Fathom, Instagram) volveria a escribir OAuth,
    sync y clasificacion de errores desde cero salvo que se extraiga la interfaz primero.
  - No existe una clasificacion comun de codigos de error de proveedor (`IntegrationErrorCode`) reutilizada
    entre Shopify y Meta; cada modulo maneja sus propios errores de forma local.
  - `private.webhook_events` existe como tabla pero solo Shopify la usa
    (`shopify-webhook-handler.ts`); Meta no tiene webhooks todavia.

## Objetivo

Definir el contrato y las tablas comunes que cualquier conector (Shopify, Meta, Klaviyo, Fathom,
Instagram) debe usar para conexiones, sincronizacion y webhooks, evitando que cada proveedor reinvente su
propio modelo de estados.

## Decisiones aprobadas

- Modelo de conexion, sync run y webhook event comun a nivel de esquema (tres tablas en DB-04), aunque
  todavia no a nivel de interfaz de codigo.
- Credenciales siempre en `private`, nunca expuestas al frontend via el endpoint de estado.
- El enum `provider` se fija por adelantado para los seis conectores previstos, aunque no todos tengan
  implementacion.

## Pendiente antes de cerrar INT-00

1. Extraer la interfaz de adaptador (`buildAuthorizationUrl`, `exchangeAuthorizationCode`,
   `refreshCredentials`, `runInitialSync`, `runIncrementalSync`, `reconcile`, `verifyWebhook`,
   `processWebhook`, `getConnectionHealth`) a partir de lo que ya hacen Shopify y Meta en paralelo, en vez
   de disenarla en abstracto.
2. Definir `IntegrationErrorCode` comun y migrar Shopify/Meta a usarlo.
3. Documentar el ciclo de vida de credenciales (rotacion, refresh concurrente, revocacion) que hoy vive
   implicito en `shopify-token-store.ts` sin equivalente para Meta.

## Criterios de cierre

- Existe una interfaz de adaptador real usada por al menos dos proveedores (no solo documentada).
- `IntegrationErrorCode` comun definido y usado por Shopify y Meta.
- Ningun payload externo llega crudo al frontend (cumplido, ver `integrations.ts`).
