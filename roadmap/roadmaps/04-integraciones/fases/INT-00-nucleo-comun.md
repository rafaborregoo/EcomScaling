# INT-00 - Nucleo comun de integraciones

> **Claim atómico de sincronización 2026-08-26:** los triggers de Shopify, Meta Ads y Klaviyo
> condicionan la transición a `syncing` al estado leído y devuelven `409` si otra petición ya ganó
> la carrera. Así se evita duplicar syncs al conectar una cuenta real o al pulsar varias veces la UI.

> **Actualización 2026-08-26:** los endpoints de token de Klaviyo y Shopify
> también usan la política común de resiliencia (timeout, retries, backoff y
> señal de cancelación). Los errores HTTP conservan su status para no reintentar
> credenciales inválidas y sí reintentar fallos transitorios.

> **Estado vigente 2026-08-24:** el contrato `IntegrationAdapter` ya se usa con Shopify y Meta Ads;
> Klaviyo e Instagram tienen adapters honestos no disponibles. La fase queda en
> `implemented_partial`: lo pendiente es la suite contractual transversal y la validacion externa de
> conectores, no la existencia del contrato base.

> **Corrección vigente 2026-08-20:** el allowlist de integración es restrictivo:
> sin flags solo Shopify queda habilitado; Meta Ads y Klaviyo requieren opt-in
> explícito. Los workflows de reconciliación declaran además su propio flag fijo
> (`shopify`, `meta_ads` o `klaviyo`) para impedir activaciones cruzadas.

> Corrección de evidencia 2026-08-02: `INTEGRATION_FEATURE_FLAGS` ya se aplica en el hook HTTP
> compartido de `apps/api/src/server.ts`, no solo en el catálogo/UI. Las rutas OAuth, sync, assets,
> métricas y reporting de Meta/Klaviyo responden `integration_feature_disabled` cuando el proveedor
> está fuera del allowlist; Shopify permanece operativo según su configuración.

## Estado

> Correccion vigente 2026-08-24: la suite contractual transversal ya existe en
> `packages/integrations/src/index.test.ts`, `apps/api/src/integration-adapters.test.ts`
> y `integration-feature-flag-routes.test.ts`. El gap restante es validacion con
> cuentas reales y ampliar runners futuros; no falta el contrato base. Ejecutada
> con `npx tsx --test` el 2026-08-24: 14/14 tests pasan.

> **Estado actualizado 2026-08-01:** la interfaz `IntegrationAdapter` ya está implementada en
> `apps/api/src/integration-adapters.ts` para Shopify y Meta Ads, incluyendo OAuth, refresh/health,
> sync y webhooks de Shopify. Klaviyo e Instagram exponen adapters de contrato no disponibles:
> devuelven `CREDENTIALS_MISSING` y health `unknown` sin crear datos ficticios. Las notas históricas
> posteriores que describen este contrato como "todavía no implementado" quedan superseded por esta
> actualización; se conservan para explicar la decisión y evolución.

- **Estado real:** `implemented_partial`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-04
- **Bloqueador:** ninguno
- **Evidencia:** `supabase/migrations/20260715151041_db_04_integraciones_comunes.sql` (tablas
  `integration_connections`, `integration_sync_runs`, `private.webhook_events`),
  `apps/api/src/integrations.ts` (`GET /v1/organizations/:organizationId/integrations`),
  `packages/integrations/src/index.ts` (contrato de proveedor, catálogo de capacidades/flags, salud, errores y `IntegrationAdapter`),
  `apps/api/src/integration-adapters.ts` (`IntegrationSyncAdapter` usado por los runners de Shopify y Meta),
  `apps/api/src/shopify-client.ts` y `apps/api/src/meta-client.ts` (clasificación compartida de errores HTTP/rate limit).
- **Que existe:**

> **Corrección documental 2026-08-02:** las notas históricas que describen el
> `IntegrationAdapter`, el catálogo o los adapters de Klaviyo/Instagram como
> inexistentes quedan superseded por el estado actual del código. La referencia de
> preparación y activación es [`../CONTRATO_PREPARACION_CONECTORES.md`](../CONTRATO_PREPARACION_CONECTORES.md).
> Shopify es operativo; Meta está preparado con validación externa pendiente; Klaviyo e
> Instagram conservan un adapter contractual no disponible y no generan datos ficticios.

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

## Estado vigente 2026-08-26

El contrato `IntegrationAdapter` ya está implementado en `apps/api/src/integration-adapters.ts` y lo
usan Shopify y Meta Ads. Klaviyo dispone del adapter de contrato y permanece preparado hasta disponer
de credenciales reales; Instagram permanece explícitamente no disponible. Las validaciones de proveedor
real no se simulan.

## Decisiones aprobadas

- Modelo de conexion, sync run y webhook event comun a nivel de esquema (tres tablas en DB-04) y
  `IntegrationAdapter` común para OAuth, sincronización, webhooks y salud.
- Credenciales siempre en `private`, nunca expuestas al frontend via el endpoint de estado.
- El enum `provider` se fija por adelantado para los seis conectores previstos, aunque no todos tengan
  implementacion.

## Contrato de adaptador (extraido de Shopify/Meta reales, actualizado 2026-08-26)

Este contrato está implementado para Shopify y Meta, con adapters de disponibilidad honesta para
Klaviyo e Instagram. La interfaz se extrae de las capacidades reales y evita que cada proveedor
exponga credenciales o estados distintos:

```ts
interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  readonly capabilities: IntegrationCapabilities;

  buildAuthorizationUrl(
    context: IntegrationAuthorizationContext,
  ): Promise<AuthorizationUrlResult>;
  exchangeAuthorizationCode(
    input: AuthorizationCallbackInput,
  ): Promise<CredentialExchangeResult>;
  refreshCredentials?(
    connection: IntegrationConnection,
  ): Promise<CredentialRefreshResult>;
  discoverAssets?(
    connection: IntegrationConnection,
  ): Promise<DiscoveredAsset[]>;
  runInitialSync(input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  runIncrementalSync(
    input: IntegrationSyncInput,
  ): Promise<IntegrationSyncResult>;
  verifyWebhook?(request: RawWebhookRequest): Promise<VerifiedWebhook>;
  processWebhook?(webhook: VerifiedWebhook): Promise<WebhookProcessingResult>;
  getConnectionHealth(
    connection: IntegrationConnection,
  ): Promise<IntegrationHealth>;
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

| Metodo del adaptador                    | Shopify (hoy)                                                                                                                         | Meta (hoy)                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `buildAuthorizationUrl`                 | `createShopifyConnectionAuthUrl` (`shopify.ts`) + `buildShopifyAuthorizeUrl` (`shopify-oauth.ts`)                                     | `createMetaConnectionAuthUrl` (`meta.ts`) + `buildMetaAuthUrl` (`meta-oauth.ts`)                                       |
| `exchangeAuthorizationCode`             | `handleShopifyOAuthCallback` (`shopify.ts`) + `exchangeShopifyCodeForToken` (`shopify-oauth.ts`), valida HMAC con `verifyShopifyHmac` | `handleMetaOAuthCallback` (`meta.ts`) + `exchangeMetaCodeForLongLivedToken` (`meta-oauth.ts`)                          |
| `refreshCredentials`                    | `refreshShopifyOfflineToken` (`shopify-oauth.ts`)                                                                                     | `getValidMetaAccessToken` (`meta.ts`) — resuelve token valido, no hay refresh explicito de token largo aun             |
| `discoverAssets`                        | No aplica (una tienda = una conexion, sin descubrimiento de activos)                                                                  | `discoverMetaAssets` (`meta.ts`) — hoy sincroniza toda la estructura descubierta, sin seleccion explicita (ver INT-02) |
| `runInitialSync` / `runIncrementalSync` | `triggerShopifySync` (`shopify.ts`), bloques via `sync_scope`                                                                         | `triggerMetaSync` (`meta.ts`)                                                                                          |
| `verifyWebhook`/`processWebhook`        | `shopify-webhook-handler.ts`/`shopify-webhooks.ts` (dual secret publico/custom)                                                       | No conectado: Meta webhooks requieren configuración y validación de la app real                                      |
| `getConnectionHealth`                   | `connectionHealth` y estado derivado común                                                                                              | `connectionHealth` y estado derivado común                                                                              |

Esta tabla confirma el estado actual: **la interfaz común ya existe y está cableada** para los dos
conectores operativos. Las diferencias restantes son capacidades del proveedor y validación externa,
no una segunda arquitectura.

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
  | "AUTHORIZATION_DENIED"
  | "INVALID_AUTHORIZATION_STATE"
  | "INVALID_CALLBACK_SIGNATURE"
  | "CREDENTIALS_MISSING"
  | "TOKEN_EXPIRED"
  | "TOKEN_REFRESH_FAILED"
  | "REAUTHORIZATION_REQUIRED"
  | "PERMISSION_MISSING"
  | "ASSET_NOT_SELECTED"
  | "EXTERNAL_RESOURCE_NOT_FOUND"
  | "RATE_LIMITED"
  | "EXTERNAL_API_UNAVAILABLE"
  | "INVALID_WEBHOOK_SIGNATURE"
  | "WEBHOOK_REPLAY_REJECTED"
  | "SYNC_PARTIAL_FAILURE"
  | "SYNC_PERMANENT_FAILURE"
  | "DATA_RECONCILIATION_MISMATCH";

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

1. Conectar y validar webhooks Meta cuando la app real tenga configuración y permisos aprobados.
2. Completar la suite de tests contractual compartida (no permite cross-tenant, no expone credenciales, sync repetido
   no duplica, error retryable reintenta, error permanente no reintenta indefinidamente, webhook duplicado
   no repite efecto, firma invalida se rechaza, revocacion cambia estado, logs sin tokens) — corre contra
   cualquier proveedor que implemente `IntegrationAdapter`, escrita una vez.

## Criterios de cierre

- **Cumplido:** existe una interfaz de adaptador completa usada por Shopify y Meta, con Klaviyo e Instagram
  representados mediante adapters honestos de disponibilidad.
- **Parcial:** Meta webhooks y validación externa de los conectores siguen condicionados por la configuración
  y aprobación de las apps reales.
- `IntegrationErrorCode` comun definido y usado por Shopify y Meta.
- Ningun payload externo llega crudo al frontend (cumplido, ver `integrations.ts`).

### Validacion adicional 2026-07-22

`deriveIntegrationHealth` en `packages/integrations` calcula el estado de salud común desde la
disponibilidad del conector, el estado persistente, el ultimo sync, errores recientes y freshness. El
endpoint de integraciones y la UI lo consumen sin inventar datos para Klaviyo o Instagram. Shopify y
Meta ya cablean OAuth, refresh, sincronización y health sobre `IntegrationAdapter`; solo los webhooks
Meta y la validación externa permanecen condicionados por las apps reales.

**Correccion de estado (2026-07-22):** `apps/api/src/integration-adapters.ts` ya implementa el
`IntegrationAdapter` completo para Shopify y Meta sobre las funciones existentes. Las rutas OAuth y sync
usan estos adapters; Shopify expone verificacion/procesamiento de webhooks y ambos exponen OAuth, refresh
y health derivado. El descubrimiento Meta aun persiste activos directamente y el contrato devuelve una
lista vacia porque la seleccion de activos no existe como funcionalidad de producto; no se fabrican assets.

## Actualizacion 2026-08-01

- `createIntegrationAdapters` expone el ciclo de vida comun para Shopify y Meta Ads, y tambien adapters de contrato para Klaviyo e Instagram.
- Klaviyo e Instagram permanecen honestamente no disponibles: sus adapters devuelven `CREDENTIALS_MISSING` al intentar autorizar o sincronizar y derivan health `unknown` con `integration_not_available`; no crean conexiones, assets ni metricas ficticias.
- Se anadio test contractual para ambos conectores futuros en `apps/api/src/integration-adapters.test.ts`. Activarlos requerira sustituir el adapter no disponible por un runner real, sin cambiar el dominio ni la UI.
- `INTEGRATION_FEATURE_FLAGS` es un allowlist reutilizable desde `@ecomscaling/integrations`; API, UI y rutas de conexión/sync lo respetan. Si no se define, solo queda habilitado Shopify; Meta y Klaviyo requieren opt-in explícito y sus credenciales. Un flag no puede activar un conector futuro que todavía no tenga implementación real.
