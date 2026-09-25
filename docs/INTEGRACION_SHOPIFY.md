# Integración con Shopify

Qué permisos pide la app, qué se rompe sin cada uno, y qué se le dice a la
persona cuando falta alguno. Hermano de
[INTEGRACION_KLAVIYO.md](INTEGRACION_KLAVIYO.md); el patrón común está en
[ADR-0006](decisions/ADR-0006-integration-module-pattern.md), y la distribución
de la app en [ADR-0005](decisions/ADR-0005-shopify-distribution.md) y
[ADR-0011](decisions/ADR-0011-shopify-custom-distribution-temporal.md).

## Permisos

Fuente única: `SHOPIFY_SCOPES_USED` en
[packages/contracts/src/index.ts](../packages/contracts/src/index.ts) — vive en
contracts porque la interfaz enseña la misma tabla que usa el backend al fallar.
Lo que se **pide** en la instalación es `SHOPIFY_SCOPES` (env) / `[access_scopes]`
de [shopify.app.toml](../shopify.app.toml); los dos tienen que decir lo mismo.

| Scope | Qué desbloquea | ¿Obligatorio? |
|---|---|---|
| `read_orders` | Pedidos | Sí |
| `read_products` | Productos y variantes | Sí |
| `read_inventory` | Inventario | Sí |
| `read_locations` | Ubicaciones de stock | Sí |
| `read_customers` | Clientes y cohortes | Sí |
| `read_all_orders` | Histórico de más de 60 días | No — requiere **Access request aprobada** en el Partner Dashboard. Sin él, la tienda se ve desde hace 60 días |
| `read_returns` | Devoluciones | No — sin él, las devoluciones no restan en los márgenes |
| `read_reports` | Sesiones y analítica | No — sin él no hay tasa de conversión; el bloque de sesiones se salta solo |
| `write_pixels` + `read_customer_events` | Pixel propio de vistas de producto (`extensions/ecomscaling-pixel`) | No — sin ellos la reconciliación no puede activar el pixel y las vistas de producto quedan sin dato |

## Qué pasa al instalar

A diferencia de una API key, aquí no hay nada que sondear: Shopify devuelve en
el propio intercambio del token los scopes concedidos. El callback los compara
con los pedidos ([shopify.ts](../apps/api/src/shopify.ts)):

- **Falta uno obligatorio** → la conexión se guarda en `error` con el motivo
  escrito (`Faltan permisos de Shopify: Pedidos (read_orders)…`) y el navegador
  vuelve a `/integraciones?shopify=missing_scopes`, que avisa en rojo.
- **Falta solo alguno opcional** → la conexión queda `connected` y se vuelve con
  `?shopify=connected_partial`: se conectó, pero con menos alcance.
- Los concedidos quedan en `integration_connections.scopes` y los que faltan en
  `metadata.missing_scopes`.

`/integraciones/shopify` muestra, por tienda y de forma permanente, qué permiso
falta y qué implica — leyendo `connection.scopes`, no un aviso de un solo uso.

## Errores durante el sync

Shopify responde a un permiso ausente con un `ACCESS_DENIED` de GraphQL:
`Access denied for orders field. Required access: 'read_orders' access scope.`
Correcto, pero en inglés y dentro de una cadena técnica. `explainShopifyError`
([shopify-permissions.ts](../apps/api/src/shopify-permissions.ts)) lo traduce en
el punto donde el error deja de ser interno — `finishSyncRun` y el
`last_error_message` de la conexión — anteponiendo el permiso que falta y qué
hacer, y conservando el mensaje original entre paréntesis para soporte.

Lo que **no** es de permisos (timeouts, 5xx, throttling) se deja tal cual: el
cliente ya reintenta con backoff y respeta `Retry-After`
([shopify-client.ts](../apps/api/src/shopify-client.ts)).

Dos reglas que evitan mentir en ese mensaje:

- **Nunca se acusa a un permiso concedido.** Los scopes de la conexión entran en
  `explainShopifyError`; si Shopify nombra uno que la tienda sí tiene, el
  problema es otro (típicamente el acceso a datos protegidos, que se aprueba
  aparte) y se respeta el mensaje original.
- **Los códigos propios no se envuelven.** Un mensaje que empieza por
  `shopify_algo_access_denied:` ya lo escribió alguien que sabía qué pasaba.

### Sesiones: un permiso opcional no rompe la tienda

`shopifyqlQuery` exige, además del scope, el acceso a **datos protegidos de
cliente Nivel 2** — aunque la consulta no pida datos de cliente. Los requisitos
y lo que nos falta están en
[SHOPIFY_DATOS_PROTEGIDOS.md](SHOPIFY_DATOS_PROTEGIDOS.md).

`read_reports` (más el acceso Nivel 2 a datos protegidos) alimenta el bloque de
sesiones. Cuando Shopify lo deniega, el bloque se anota como **aviso**, no como
fallo: la tienda se queda sin tasa de conversión, no en error. Antes una tienda
sin analítica aparecía tan rota como una sin pedidos.

Relacionado: una conexión en `syncing` cuyo último error es posterior al último
sync correcto se considera **colgada** (`degraded`), no "sincronizando"
([packages/integrations](../packages/integrations/src/index.ts)). Es el estado
típico de una tienda con app personalizada cuyas credenciales no están
configuradas en ese entorno.

## Errores que vas a ver

| Error | Qué pasó | Arreglo |
|---|---|---|
| `?shopify=missing_scopes` | La instalación no concedió algo obligatorio | Reinstalar la app aceptando todos los permisos |
| `?shopify=connected_partial` | Conectó sin permisos opcionales | Mirar el aviso de la tienda en `/integraciones/shopify` |
| "Faltan permisos de Shopify: …" en un bloque del sync | `ACCESS_DENIED` al pedir un recurso | Reinstalar con ese permiso |
| `shopify_token_exchange_failed` | El código de instalación no se pudo canjear | Repetir la conexión; si insiste, revisar credenciales de la app |
| `shopify_graphql_http_401` | Token revocado (app desinstalada en la tienda) | Volver a conectar la tienda |
| `shopify_graphql_http_429` | Throttling | Se reintenta solo; si persiste, esperar |

## Cambiar los scopes

Tocar `[access_scopes]` del toml **no** actualiza las tiendas ya instaladas:
Shopify solo vuelve a pedir consentimiento cuando la tienda pasa otra vez por la
instalación. Al añadir un scope hay que reinstalar tienda por tienda; hasta
entonces sus conexiones se quedan con los scopes viejos y, si el nuevo era
obligatorio, aparecerán como incompletas en la interfaz — que es justo lo que se
quiere que se vea.

## Pixel de vistas de producto

Shopify no da las vistas de producto por API, así que EcomScaling tiene su propio
Web Pixel en [extensions/ecomscaling-pixel](../extensions/ecomscaling-pixel/shopify.extension.toml). Envía
cada `product_viewed` a `POST /v1/pixel/events?s=<store_id>` y la API lo guarda en
`shopify_pixel_events` (con el client_id ya resumido). La función
`shopify_product_views` alimenta `conversion_cro.product_views`.

Para que funcione en una tienda:

1. `shopify app deploy` publica la extensión (una vez por versión de la app).
2. La tienda tiene que haber concedido `write_pixels` y `read_customer_events`
   (reinstalar si se conectó antes del 2026-09-25).
3. La reconciliación nocturna llama a `webPixelCreate` con el id de la tienda y la
   URL de la API. Es idempotente; si faltan los permisos lo registra como
   `web_pixel_activation_failed` y sigue.

El pixel solo corre con consentimiento de analítica del comprador
(`customer_privacy.analytics = true`). Antes de la primera vista registrada,
`first_event_at` es null y el dato es desconocido, no cero.
