# DB-05 - Shopify vertical slice

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** DB-00, DB-02, DB-04
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migraciones `20260715173726_db_05_shopify_vertical_slice.sql` + `db_05a` a `db_05g` (sync blocks, metrics, all-time, performance, margin, store scope), todas aplicadas en remoto (confirmado via `supabase migration list`, 2026-07-20). La nota "pendiente aplicar db_05a" de este documento estaba obsoleta.
  - `shopify_customers` **si existe** en el esquema real (`supabase/migrations/20260715200000_db_06_shopify_customers.sql`) — la incoherencia que senalaba el snapshot conceptual (retirado) estaba en ese archivo, no en el esquema real.
  - Validado con una tienda real (`padelespana.myshopify.com`): ventas, margen, stock y top productos visibles en `/shopify`.
  - Fix real 2026-07-20: webhooks de la tienda rechazados al 100% por verificar el HMAC con el secret equivocado (ver DB-04); tras el fix, la reconciliacion periodica (worker, cron diario 2am) cubre lo que los webhooks no capturen.
- **Resuelto 2026-07-23 (tolerancia de reconciliacion por KPI)**: formalizada contra la medicion real
  ejecutada 2026-07-22 sobre `padelespana.myshopify.com` (`reconcileShopifyCounts`,
  `apps/api/src/shopify-count-reconcile.ts`). Base medida: `products` 11 local / 11 Shopify (diff 0);
  `orders` 363 local / 341 Shopify (diff +22, local por encima del conteo de Shopify). El scope OAuth
  configurado (`SHOPIFY_SCOPES`) incluye `read_orders` pero no `read_all_orders` -- confirmado en
  `packages/config/src/index.ts`/`shopify-oauth.ts` -- y `read_orders` sin `read_all_orders` es una
  restriccion documentada de la propia Shopify Admin API: el campo `ordersCount` (y las consultas de
  pedidos en general) quedan acotadas a los ultimos 60 dias salvo que se apruebe el scope protegido. El
  local va por encima porque conserva el historico completo importado, mientras el conteo de Shopify bajo
  este scope no. **Politica de tolerancia**: `products`/`customers` deben reconciliar exacto (diff 0
  esperado, no estan sujetos a la restriccion de 60 dias); `orders` puede mostrar `local > shopify` sin que
  sea una alarma, siempre que la diferencia sea explicable por pedidos con mas de 60 dias de antiguedad
  (verificable filtrando localmente por fecha) -- un `local < shopify` en cualquier dataset, o un diff en
  `orders` que no se explique por antiguedad, si es una alarma real de sync roto.
- **Gaps identificados que siguen abiertos:**
  - Sin politica de PII explicita para clientes (que se hashea, con que sal, retencion) mas alla de que `shopify_customers` evita guardar PII directa.
  - Sin tabla de calidad de dato (import completo / coste incompleto / historico limitado) visible para el consultor mas alla del banner de "datos incompletos" del dashboard.
  - `shopify_daily_store_metrics`/`shopify_daily_product_metrics`/`shopify_daily_product_traffic_metrics` mencionadas como pendientes en este documento: las metricas reales se calculan via funciones SQL (`shopify_sales_summary`, `shopify_financial_summary`, etc.), no via tablas de agregados diarios materializadas — decision valida, pero el documento no lo refleja.
- **Siguiente accion:** decidir si vale la pena convertir la politica de tolerancia de arriba en un chequeo
  automatico (alerta si `orders` diff no se explica por antiguedad, o si cualquier dataset da `local <
  shopify`) en vez de solo quedar documentada.

## Objetivo

Soportar conexion Shopify, importacion inicial, reconciliacion y dashboard financiero MVP.

## Tablas del slice actual

- `shopify_stores`
- `shopify_products`
- `shopify_variants`
- `shopify_inventory_items`
- `shopify_locations`
- `shopify_order_facts`
- `shopify_order_items`
- `shopify_refunds`
- `shopify_refund_items`
- `shopify_customers`
- `product_costs`
- `shopify_inventory_level_snapshots`
- `integration_sync_runs.sync_scope` para trazabilidad por bloque (`catalog`, `inventory`, `orders`, `refunds`, `customers`)

## Pendiente para la siguiente iteracion

- ~~Aplicar en remoto `20260715180000_db_05a_shopify_sync_blocks.sql`~~ — aplicada (ver Estado).
- Metricas por dia via tabla materializada (`shopify_daily_store_metrics`, `shopify_daily_product_metrics`,
  `shopify_daily_product_traffic_metrics`) si el calculo on-the-fly via funciones SQL deja de escalar.
- Proveedores y forecasts, si entra en F12.

## Criterios de cierre

- Importacion inicial de tienda, catalogo, inventario y pedidos.
- Reconciliacion por `updated_at` o estrategia equivalente.
- Datos minimizados: no almacenar PII innecesaria de compradores.
- KPIs basicos calculables desde datos normalizados, no desde `raw_data`.
- El import inicial queda disparado tras conectar Shopify y deja trazabilidad en `integration_sync_runs`.
- Los bloques de sync quedan separados para que un fallo parcial no bloquee toda la integracion.
