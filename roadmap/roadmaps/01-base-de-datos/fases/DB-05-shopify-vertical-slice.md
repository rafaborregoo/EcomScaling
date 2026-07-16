# DB-05 - Shopify vertical slice

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

- Aplicar en remoto `20260715180000_db_05a_shopify_sync_blocks.sql`.
- `shopify_daily_store_metrics`
- `shopify_daily_product_metrics`
- `shopify_daily_product_traffic_metrics`
- proveedores y forecasts, si entra en F12.

## Criterios de cierre

- Importacion inicial de tienda, catalogo, inventario y pedidos.
- Reconciliacion por `updated_at` o estrategia equivalente.
- Datos minimizados: no almacenar PII innecesaria de compradores.
- KPIs basicos calculables desde datos normalizados, no desde `raw_data`.
- El import inicial queda disparado tras conectar Shopify y deja trazabilidad en `integration_sync_runs`.
- Los bloques de sync quedan separados para que un fallo parcial no bloquee toda la integracion.
