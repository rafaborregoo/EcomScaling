# INT-01 - Shopify

## Estado

- **Estado real:** `pilot_ready` (**actualizado 2026-07-22** — los 5 items del checklist "Cierre real" ya
  estan resueltos: webhooks de privacidad deployados, `app/uninstalled` reenviado, backoff confirmado,
  scope decidido explicitamente, reconciliacion de conteos ejecutada con hallazgo explicado. Sigue sin ser
  `done` porque el bloqueador de distribucion publica de Shopify es externo, ver abajo.)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** INT-00, DB-05, BE-03
- **Bloqueador:** Shopify aun no ha aprobado la distribucion publica de la app
  (`docs/decisions/ADR-0005-shopify-distribution.md`); en produccion se usa temporalmente `Custom
  distribution` (commit `bf54847`, 2026-07-17) hasta esa aprobacion. La instalacion via un link de
  distribucion custom llega sin el `state` que el backend sembraria en el flujo OAuth propio — ya se
  acepta HMAC + coincidencia de shop-domain como alternativa (commit `f74fcc0`, 2026-07-20).
- **Evidencia:** `apps/api/src/shopify-oauth.ts`, `shopify.ts`, `shopify-sync.ts`, `shopify-bulk.ts`,
  `shopify-webhook-handler.ts`, `shopify-webhooks.ts`, `shopify-reconcile.ts`, `shopify-token-store.ts`.

## Decisiones aprobadas

- Distribucion publica para produccion (ADR-0005); custom distribution solo mientras Shopify revisa la
  app publica — **no** es la decision final, es un estado temporal documentado en el commit `bf54847`.
- Una `integration_connection` por tienda, no por organizacion con multiples tiendas mezcladas.
- Tokens offline cifrados en `private`, con refresco automatico antes de expirar
  (`shopify-token-store.ts`, commit `69e78f4`).
- HMAC de OAuth y de webhooks se valida contra dos secretos posibles (`SHOPIFY_API_SECRET` de la app
  publica y `SHOPIFY_CUSTOM_API_SECRET` de la app custom) porque ambas conviven mientras dura la
  transicion — no es deuda tecnica, es el puente necesario para no romper las tiendas ya instaladas por
  custom distribution cuando se apruebe la publica.
- Sync en bloques independientes (`sync_scope`: catalog, inventory, orders, refunds, customers), cada uno
  con su fila en `integration_sync_runs`, siguiendo el patron obligatorio de
  `docs/decisions/ADR-0006-integration-module-pattern.md`.

## Scopes

`.env.example` fija `SHOPIFY_SCOPES` con una lista amplia orientada a lectura (`read_products`,
`read_inventory`, `read_locations`, `read_orders`, `read_customers`, `read_reports`,
`read_shopify_payments_*`, `read_discounts`, `read_returns`, entre otros). **Pendiente**: no hay
documentado en este archivo cual de esos scopes es minimo-viable y cual es "nice to have" — la lista
actual es mas amplia que lo que el MVP usa realmente en `shopify-sync.ts`. No se ha decidido explicitamente
si se pide un scope de historico extendido mas alla de la ventana por defecto de pedidos.

## Recursos sincronizados

Bulk Operations (`shopify-bulk.ts`) para importacion inicial y consultas grandes; `shopify-sync.ts`
implementa import completo e incremental (`updated_at >= last_sync_at`) como el mismo codigo
parametrizado, por bloque:

| Bloque | Metodo inicial | Incremental | Reconciliacion |
| --- | --- | --- | --- |
| Catalog (productos/variantes) | Bulk | Webhook (`products/update`) + query | `shopify-reconcile.ts` |
| Inventory | Bulk | Webhook (`inventory_levels/update`) + query | `shopify-reconcile.ts` |
| Orders | Bulk | Webhook (`orders/create`, `orders/updated`) + watermark | `shopify-reconcile.ts` |
| Refunds | Bulk | **Sin webhook dedicado** (ver gap abajo) | `shopify-reconcile.ts` |
| Customers | Bulk minimo (referencia pseudonimizada) | Order sync | `shopify-reconcile.ts` |

## Webhooks

**Correccion 2026-07-20**: una revision anterior de este documento decia "solo 4 topics, sin
`refunds/create`" — verificado de nuevo contra `shopify-webhooks.ts`, `refunds/create` ya estaba
registrado (el panel de Shopify reportado por Rafa mostraba trafico solo en 4 topics porque la tienda
piloto no habia tenido refunds todavia en esa ventana, no porque el topic no existiera).

Topics registrados hoy (`SHOPIFY_WEBHOOK_TOPICS`): `orders/create`, `orders/updated`, `refunds/create`,
`products/update`, `inventory_levels/update`, y **`app/uninstalled` (anadido 2026-07-20, R-010)** — sin
el, el backend no se enteraba de una desinstalacion hecha desde Shopify y la conexion quedaba en
`connected` de forma incorrecta; ahora `processAppUninstalled` marca la conexion `disconnected`.

**Webhooks de privacidad obligatorios anadidos 2026-07-20 (R-010)**: `customers/data_request`,
`customers/redact`, `shop/redact` tienen handler en `shopify-webhook-handler.ts`
(`COMPLIANCE_TOPIC_HANDLERS`) — verifican HMAC igual que el resto, dejan constancia en
`private.webhook_events`, y:

- `customers/redact` borra la fila de `shopify_customers` del cliente (solo guardamos hash de referencia +
  id externo, nunca email/nombre/telefono — ver DB-05, asi que borrar la fila es la erradicacion completa
  que nos corresponde).
- `shop/redact` marca la conexion `disconnected`. **Deliberadamente no** dispara borrado en cascada
  automatico del historico (pedidos/metricas/costes) — eso es el mismo riesgo de borrado irreversible que
  ya esta documentado sin resolver (ver `RIESGOS.md`, Q-009); requiere decision de producto de Rafa, no una
  tomada dentro de un webhook.
- `customers/data_request` solo deja constancia (no hay email/nombre que exportar automaticamente).

**Resuelto 2026-07-22**: estos 3 topics de privacidad no se registran via `webhookSubscriptionCreate` como
el resto — Shopify los trata como "compliance webhooks" a nivel de app entera, no por tienda. El panel
clasico del Partner Dashboard (App setup > Compliance webhooks) ya no aplica a esta app (creada en el Dev
Dashboard nuevo); se configuran via `shopify.app.toml` + `shopify app deploy`. Vinculado el repo a la app
real ("EcomScaling - Custom", client_id de `SHOPIFY_CUSTOM_API_KEY`) con
`shopify app config link --client-id ...`, anadido el bloque `[[webhooks.subscriptions]]` con
`compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]` apuntando a
`https://ecom-scaling-api.vercel.app/v1/shopify/webhooks`, y deployado como version `ecomscaling-custom-4`.
Verificado en vivo: el endpoint responde `401 Unauthorized` a un POST con HMAC invalido, confirmando que
esta desplegado y validando firmas de verdad, no solo declarado en la config. `shopify.app.toml` queda en
el repo (no versionado todavia, pendiente de que Rafa decida si se comitea).

**Resuelto 2026-07-22**: reenviado el registro a la tienda piloto ya conectada
(`padelespana.myshopify.com`). Nueva funcion `resendShopifyWebhookRegistrations`
(`apps/api/src/shopify-webhooks.ts`, script `apps/worker/src/shopify-resend-webhooks-once.ts`,
`npm run dev:shopify-resend-webhooks -w @ecomscaling/worker`) reutiliza `registerShopifyWebhooks` sobre
todas las conexiones Shopify existentes -- idempotente: los 5 topics ya registrados devuelven "Address for
this topic has already been taken" (no fatal), y `app/uninstalled` se registro de nuevo
(`gid://shopify/WebhookSubscription/2052274389370`). Requiere pasar `SHOPIFY_REDIRECT_URI` de produccion
explicitamente al ejecutar en local, ya que `.env.local` trae el valor de `localhost` por defecto y Shopify
rechaza URLs `http://`/internas.

Verificacion HMAC ya prueba ambos secretos (fix de esta sesion, commit `f74fcc0`); deduplicacion por
webhook id vive en `private.webhook_events` (INT-00).

## Rate limits

**Verificado 2026-07-22** (antes marcado "pendiente de verificar, no asumir"): `shopify-client.ts`
(`shopifyGraphql`) si reintenta con backoff exponencial (`BASE_BACKOFF_MS * 2^intento`, hasta 5 intentos) —
pero **reactivo**, no proactivo: detecta HTTP 429/5xx (respetando `Retry-After` si Shopify lo manda) y el
error GraphQL `extensions.code === "THROTTLED"`, no lee `extensions.cost.throttleStatus.currentlyAvailable`/
`restoreRate` para espaciar peticiones antes de que ocurra el throttling. Es una mitigacion real, distinta
de la que el documento original especulaba.

## Pruebas

Sin suite de integracion contra una tienda real confirmada en este documento (distinto de las pruebas RLS
de DB-02, que son multi-tenant, no Shopify-especificas). Pendiente: tienda con más de 60 dias de pedidos,
varias ubicaciones, pedido editado, devolucion parcial, webhook duplicado, webhooks fuera de orden, app
desinstalada, bulk fallido, throttling.

## Cierre real

**Reconciliacion de conteos ejecutada 2026-07-22** contra la tienda piloto real (`padelespana.myshopify.com`,
363 pedidos): nuevo modulo `apps/api/src/shopify-count-reconcile.ts`
(`reconcileShopifyCounts`, expuesto via `@ecomscaling/api/shopify-count-reconcile`) + script
`apps/worker/src/shopify-reconcile-counts-once.ts`
(`npm run dev:shopify-reconcile-counts -w @ecomscaling/worker -- <connection_id>`), compara conteos locales
contra `productsCount`/`ordersCount`/`customersCount` de la Admin GraphQL API (`precision: EXACT` o
`AT_LEAST` segun el campo, se reporta tal cual, no se asume exactitud).

Resultado: **productos 11 vs 11, exacto**. **Pedidos: 363 local vs 341 en Shopify — diferencia de 22,
explicada y no es un problema de datos**: Shopify solo cuenta pedidos de los ultimos 60 dias via API salvo
que la app tenga aprobado `read_all_orders` (no solicitado hoy, ver punto 4 abajo); los 22 pedidos "de mas"
son historial real de mayo 2026 (el mas antiguo, `#6082`, del 18/05) que el sync inicial importo cuando
todavia estaban dentro de la ventana de 60 dias -- verificado descartando explicitamente `is_test_order` (0
ordenes de prueba) y `cancelled_at` (0 canceladas) antes de concluir esto. **No se borro ni se debe borrar
nada**: son pedidos reales, Shopify simplemente ya no los cuenta en su API estandar por la ventana temporal.
Clientes: 10.807 local vs "al menos 10.000" en Shopify (`precision: AT_LEAST`) -- no comparable de forma
fiable, Shopify topa ese conteo en tiendas grandes, no es una discrepancia real. Refunds: 1 local, sin
equivalente expuesto por Shopify a nivel tienda para comparar.

No cerrar INT-01 hasta:

1. ~~Anadir los 3 webhooks de privacidad obligatorios~~ — hecho 2026-07-20 en codigo, y deployados a
   Shopify 2026-07-22 (`ecomscaling-custom-4`, ver seccion Webhooks arriba).
2. ~~Anadir `app/uninstalled`~~ — hecho 2026-07-20 en codigo; reenviado a la tienda piloto ya conectada
   2026-07-22 (`resendShopifyWebhookRegistrations`, ver seccion Webhooks arriba).
3. ~~Confirmar en codigo el manejo real de throttling/backoff~~ — hecho 2026-07-22: backoff reactivo real
   confirmado (HTTP 429/5xx + error `THROTTLED`), no proactivo via `throttleStatus`. Decidir si vale la
   pena el modo proactivo o el reactivo basta para el volumen actual.
4. ~~Decidir explicitamente el scope minimo-viable~~ — decision explicita de Rafa 2026-07-22: mantener la
   lista amplia que trae el Dev Dashboard tal cual (no acotar) mientras dure la fase de pruebas, ya
   deployada en `shopify.app.toml`. No es "minimo-viable" pero es una decision tomada, no un olvido —
   revisar antes de solicitar distribucion publica final.
5. ~~Validar con tienda real: conteos, webhooks con URL publica, reconciliacion~~ — hecho 2026-07-22 contra
   `padelespana.myshopify.com` (ver "Reconciliacion de conteos ejecutada" arriba). Productos exacto; pedidos
   con diferencia explicada (ventana de 60 dias de la API, no un bug); clientes no comparable de forma
   fiable por el tope de conteo de Shopify. Sigue pendiente decidir si vale la pena solicitar
   `read_all_orders` para que el conteo en vivo de Shopify tambien vea el historico completo (no es
   necesario para que el producto funcione, ya lo tenemos importado).
