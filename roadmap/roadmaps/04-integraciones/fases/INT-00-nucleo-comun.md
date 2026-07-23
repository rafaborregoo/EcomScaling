# INT-00 - Nucleo comun de integraciones

## Estado

- **Estado real:** `in_progress`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** DB-04
- **Bloqueador:** ninguno
- **Evidencia:** `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql` (tablas
  `integration_connections`, `integration_sync_runs`, `private.webhook_events`),
  `apps/api/src/integrations.ts` (`GET /v1/organizations/:organizationId/integrations`),
  `packages/integrations/src/index.ts` (contrato de proveedor, catálogo de capacidades/flags, salud, errores y `IntegrationAdapter`),
  `apps/api/src/integration-adapters.ts` (`IntegrationSyncAdapter` usado por los runners de Shopify y Meta),
  `apps/api/src/shopify-client.ts` y `apps/api/src/meta-client.ts` (clasificación compartida de errores HTTP/rate limit).
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
  - La interfaz completa `IntegrationAdapter` ya existe como contrato TypeScript, pero todavía no está implementada
    por OAuth/health/webhooks de Shopify y Meta. La subinterfaz ejecutable `IntegrationSyncAdapter` sí está usada
    por ambos runners a través de `apps/api/src/integration-adapters.ts`. Shopify
    (`shopify.ts`, `shopify-oauth.ts`, `shopify-sync.ts`, `shopify-webhook-handler.ts`, ...) y Meta
    (`meta.ts`, `meta-oauth.ts`, `meta-sync.ts`) implementan el mismo patron de forma paralela pero sin un
    contrato compartido — cada conector nuevo (Klaviyo, Fathom, Instagram) volveria a escribir OAuth,
    sync y clasificacion de errores desde cero salvo que se extraiga la interfaz primero.
  - El catálogo ejecutable ya expone Shopify/Meta como implementaciones disponibles y Klaviyo/Instagram como
    conectores planificados (`available: false`), con capacidades y `feature_flag` para que la UI no tenga que
    inventar estados ni datos cuando todavía no hay credenciales.
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

## Contrato de adaptador (extraido de Shopify/Meta reales, 2026-07-22)

Esto es un contrato **documentado, todavia no implementado en codigo** — Shopify y Meta siguen
implementando el mismo patron en paralelo sin compartir una interfaz TypeScript real. La forma de abajo se
extrajo mapeando cada metodo a la funcion que ya existe hoy, no diseñada en abstracto:

```ts
interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  readonly capabilities: IntegrationCapabilities;

  buildAuthorizationUrl(context: IntegrationAuthorizationContext): Promise<AuthorizationUrlResult>;
  exchangeAuthorizationCode(input: AuthorizationCallbackInput): Promise<CredentialExchangeResult>;
  refreshCredentials?(connection: IntegrationConnection): Promise<CredentialRefreshResult>;
  discoverAssets?(connection: IntegrationConnection): Promise<DiscoveredAsset[]>;
  runInitialSync(input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  runIncrementalSync(input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  verifyWebhook?(request: RawWebhookRequest): Promise<VerifiedWebhook>;
  processWebhook?(webhook: VerifiedWebhook): Promise<WebhookProcessingResult>;
  getConnectionHealth(connection: IntegrationConnection): Promise<IntegrationHealth>;
}

type IntegrationCapabilities = {
  oauth: boolean;
  tokenRefresh: boolean;
  webhooks: boolean;
  initialSync: boolean;
  incrementalSync: boolean;
  assetSelection: boolean;
};
```

### Mapeo real por proveedor (que funcion de hoy cubre cada metodo)

| Metodo del adaptador | Shopify (hoy) | Meta (hoy) |
| --- | --- | --- |
| `buildAuthorizationUrl` | `createShopifyConnectionAuthUrl` (`shopify.ts`) + `buildShopifyAuthorizeUrl` (`shopify-oauth.ts`) | `createMetaConnectionAuthUrl` (`meta.ts`) + `buildMetaAuthUrl` (`meta-oauth.ts`) |
| `exchangeAuthorizationCode` | `handleShopifyOAuthCallback` (`shopify.ts`) + `exchangeShopifyCodeForToken` (`shopify-oauth.ts`), valida HMAC con `verifyShopifyHmac` | `handleMetaOAuthCallback` (`meta.ts`) + `exchangeMetaCodeForLongLivedToken` (`meta-oauth.ts`) |
| `refreshCredentials` | `refreshShopifyOfflineToken` (`shopify-oauth.ts`) | `getValidMetaAccessToken` (`meta.ts`) — resuelve token valido, no hay refresh explicito de token largo aun |
| `discoverAssets` | No aplica (una tienda = una conexion, sin descubrimiento de activos) | `discoverMetaAssets` (`meta.ts`) — hoy sincroniza toda la estructura descubierta, sin seleccion explicita (ver INT-02) |
| `runInitialSync` / `runIncrementalSync` | `triggerShopifySync` (`shopify.ts`), bloques via `sync_scope` | `triggerMetaSync` (`meta.ts`) |
| `verifyWebhook`/`processWebhook` | `shopify-webhook-handler.ts`/`shopify-webhooks.ts` (dual secret publico/custom) | No implementado — Meta no tiene webhooks todavia |
| `getConnectionHealth` | Derivado de scopes concedidos vs. requeridos + `STALE_SYNCING_MS` (`shopify.ts:29`) | No implementado como funcion propia |

Esta tabla confirma el diagnostico: **la forma ya existe de facto**, pero como codigo paralelo sin
interfaz compartida — extraer `IntegrationAdapter` a `packages/integrations` (o equivalente) es refactor de
lo ya escrito, no diseño desde cero. Klaviyo seria el primer conector nuevo que implementa la interfaz
directamente en vez de escribir su propio patron ad-hoc por tercera vez.

### Estados: separar persistente de derivado

`integration_connections.status` (columna real, constraint de DB) debe seguir siendo el ciclo persistente
minimo: `pending | connected | syncing | error | disconnected | revoked`. No añadir mas valores a esa
columna. Lo que hoy se resuelve en tiempo de lectura (reautorizacion por scopes en Shopify) debe
generalizarse como un **estado derivado**, calculado, nunca guardado como columna nueva:

```ts
type IntegrationHealthState =
  | "healthy"
  | "syncing"
  | "degraded"
  | "reauthorization_required"
  | "permissions_missing"
  | "stale"
  | "external_outage"
  | "unknown";
```

`health.status` se calcula a partir de: credenciales validas, scopes concedidos vs. requeridos, ultimo
sync, fallos recientes, y freshness — el mismo calculo que Shopify ya hace ad-hoc para
"reautorizacion necesaria", generalizado para que Meta/Klaviyo lo reutilicen sin reinventarlo.

### Catalogo comun de errores (definido y usado por los clientes HTTP; falta extenderlo a OAuth/sync)

```ts
type IntegrationErrorCode =
  | "AUTHORIZATION_DENIED" | "INVALID_AUTHORIZATION_STATE" | "INVALID_CALLBACK_SIGNATURE"
  | "CREDENTIALS_MISSING" | "TOKEN_EXPIRED" | "TOKEN_REFRESH_FAILED" | "REAUTHORIZATION_REQUIRED"
  | "PERMISSION_MISSING" | "ASSET_NOT_SELECTED" | "EXTERNAL_RESOURCE_NOT_FOUND" | "RATE_LIMITED"
  | "EXTERNAL_API_UNAVAILABLE" | "INVALID_WEBHOOK_SIGNATURE" | "WEBHOOK_REPLAY_REJECTED"
  | "SYNC_PARTIAL_FAILURE" | "SYNC_PERMANENT_FAILURE" | "DATA_RECONCILIATION_MISMATCH";

class IntegrationError extends Error {
  integrationCode: IntegrationErrorCode;
  provider: IntegrationProvider;
  retryable: boolean;
  userActionRequired: boolean;
  externalStatus?: number;
  externalCode?: string;
}
```

Los clientes HTTP de Shopify y Meta ya convierten errores de rate limit y disponibilidad externa a
`IntegrationError` (`ShopifyGraphError`/`MetaGraphError`). OAuth, sincronización, webhooks y reconciliación
todavía conservan errores locales y deben migrarse cuando se cablee el adaptador completo.

## Pendiente antes de cerrar INT-00

1. Extender `IntegrationSyncAdapter` a `IntegrationAdapter` completo, empezando por OAuth/health de Shopify
   sin romper su comportamiento actual, luego Meta y sus webhooks donde proceda.
2. Extender `IntegrationErrorCode` común desde los clientes HTTP a OAuth, sincronización, webhooks y reconciliación.
3. Documentar el ciclo de vida de credenciales (rotacion, refresh concurrente, revocacion) que hoy vive
   implicito en `shopify-token-store.ts` sin equivalente para Meta.
4. Suite de tests contractual compartida (no permite cross-tenant, no expone credenciales, sync repetido
   no duplica, error retryable reintenta, error permanente no reintenta indefinidamente, webhook duplicado
   no repite efecto, firma invalida se rechaza, revocacion cambia estado, logs sin tokens) — corre contra
   cualquier proveedor que implemente `IntegrationAdapter`, escrita una vez.

## Criterios de cierre

- **Pendiente:** existe una interfaz de adaptador completa usada por al menos dos proveedores (no solo documentada).
- **Cumplido parcialmente:** la capa de sincronización común (`IntegrationSyncAdapter`) es usada por Shopify y Meta;
  la interfaz completa sigue pendiente hasta que OAuth/health/webhooks compartan también el contrato.
- `IntegrationErrorCode` comun definido y usado por Shopify y Meta.
- Ningun payload externo llega crudo al frontend (cumplido, ver `integrations.ts`).

### Validacion adicional 2026-07-22

`deriveIntegrationHealth` en `packages/integrations` ya calcula el estado de salud comun desde la
disponibilidad del conector, el estado persistente, el ultimo sync, errores recientes y freshness. El
endpoint de integraciones y la UI lo consumen sin inventar datos para Klaviyo o Instagram. La interfaz
completa de OAuth, health operativo y webhooks sigue pendiente de cablearse sobre `IntegrationAdapter`.

**Correccion de estado (2026-07-22):** `apps/api/src/integration-adapters.ts` ya implementa el
`IntegrationAdapter` completo para Shopify y Meta sobre las funciones existentes. Las rutas OAuth y sync
usan estos adapters; Shopify expone verificacion/procesamiento de webhooks y ambos exponen OAuth, refresh
y health derivado. El descubrimiento Meta aun persiste activos directamente y el contrato devuelve una
lista vacia porque la seleccion de activos no existe como funcionalidad de producto; no se fabrican assets.
