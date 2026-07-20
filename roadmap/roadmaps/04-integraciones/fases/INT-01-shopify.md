# INT-01 - Shopify

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
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

**Solo 4 topics estan registrados** (`shopify-webhooks.ts`): `orders/create`, `orders/updated`,
`products/update`, `inventory_levels/update`. Esto coincide exactamente con el panel de developers de
Shopify reportado por Rafa el 2026-07-20 (100% tasa de entrega, sin fallos reales — la alarma era solo que
esos son los unicos 4 topics con trafico).

**Gaps reales frente a lo que Shopify espera de una app publica:**

- No hay webhooks de privacidad obligatorios para distribucion publica: `customers/data_request`,
  `customers/redact`, `shop/redact`. Sin estos, Shopify **no aprobara** la app publica — este es
  probablemente el bloqueador de aprobacion mas concreto y accionable que existe hoy, mas alla de
  "esperar revision".
- No hay `app/uninstalled` ni `shop/update` registrados — sin `app/uninstalled` el backend no se entera de
  una desinstalacion hecha desde Shopify y la conexion queda en `connected` de forma incorrecta.
- No hay `refunds/create` — los refunds dependen solo de bulk/reconciliacion periodica, no de señal en
  tiempo real.
- Verificacion HMAC ya prueba ambos secretos (fix de esta sesion, commit `f74fcc0`); deduplicacion por
  webhook id vive en `private.webhook_events` (INT-00).

## Rate limits

`shopify-bulk.ts`/`shopify-client.ts` implementan el cliente GraphQL/Bulk; no se ha confirmado con grep
que se lea `extensions.cost.throttleStatus` y se reintente segun `currentlyAvailable`/`restoreRate` —
**pendiente de verificar en codigo antes de marcar esto como hecho**, no asumir que existe solo porque el
ADR-0006 lo exige desde el primer commit.

## Pruebas

Sin suite de integracion contra una tienda real confirmada en este documento (distinto de las pruebas RLS
de DB-02, que son multi-tenant, no Shopify-especificas). Pendiente: tienda con más de 60 dias de pedidos,
varias ubicaciones, pedido editado, devolucion parcial, webhook duplicado, webhooks fuera de orden, app
desinstalada, bulk fallido, throttling.

## Cierre real

No cerrar INT-01 hasta reconciliar conteos app vs Shopify Admin (productos, variantes, pedidos, refunds,
clientes pseudonimizados) con una tienda real con pedidos, y hasta:

1. Anadir los 3 webhooks de privacidad obligatorios (`customers/data_request`, `customers/redact`,
   `shop/redact`) — condicion previa a que Shopify apruebe distribucion publica.
2. Anadir `app/uninstalled` para no dejar conexiones huerfanas en estado `connected`.
3. Confirmar en codigo el manejo real de `throttleStatus`/backoff, no solo asumirlo.
4. Decidir explicitamente el scope minimo-viable de `.env.example` (hoy es mas amplio de lo necesario).
5. Validar con tienda real: conteos, webhooks con URL publica, reconciliacion.
