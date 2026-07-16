# INT-01 - Shopify

## Objetivo

Conectar una tienda y mantener catalogo, inventario, pedidos y refunds sincronizados.

## Entregables

- OAuth Shopify. Estado: implementado en local; se usara `Public distribution` en productivo y `Custom distribution` solo para pruebas internas.
- Offline access token cifrado. Estado: implementado.
- Bulk Operations para importacion inicial. Estado: implementado para catalogo, inventario, pedidos, refunds y clientes.
- Sync por bloques independientes (`catalog`, `inventory`, `orders`, `refunds`, `customers`). Estado: implementado; requiere aplicar migracion `DB-05a` en remoto.
- Webhooks incrementales. Estado: endpoint y registro inicial implementados; pendiente validar con tienda real/publica.
- Reconciliacion periodica. Estado: endpoint/pasada manual implementada; pendiente scheduler/worker definitivo.
- Manejo de rate limits y paginacion. Estado: base implementada en cliente GraphQL/Bulk; pendiente pruebas con volumen real.
- Control de version de scopes requeridos vs scopes concedidos por tienda. Estado: implementado en action band.
- Estado `reauthorization_required` cuando el producto necesite permisos nuevos. Estado: implementado como accion de cuenta; pendiente pulido visual final.

## Avance 2026-07-15

- Decision documentada en `docs/decisions/ADR-0005-shopify-distribution.md`.
- La app productiva debe poder instalarse en tiendas de clientes distintos.
- El backend mantendra una conexion por organizacion, no una app por cliente.
- La callback URL tecnica es la del backend, no la URL de admin de Shopify.
- Para este repo se usa `http://localhost:4000/v1/shopify/oauth/callback` en local; en produccion se sustituye por una URL publica.
- Cuando se amplian permisos Shopify, la tienda debe reautorizar la app. No basta con cambiar `SHOPIFY_SCOPES` en backend.
- La UI debe detectar diferencia entre scopes requeridos y concedidos, y mostrar una banda superior a la empresa para reconectar Shopify.

## Criterios de cierre

- Importacion completa de datos MVP. Estado: validada con tienda de prueba; pendiente tienda con pedidos reales.
- Minimizacion de PII. Estado: clientes se guardan sin email/nombre y con referencia hash.
- Comparacion manual contra Shopify validada. Estado: pendiente con tienda real o tienda test con pedidos.
- Si faltan permisos, la empresa ve una accion clara de reautorizacion y no solo un error tecnico. Estado: implementado.

## Pendiente antes de cerrar INT-01

1. Aplicar en Supabase remoto `20260715180000_db_05a_shopify_sync_blocks.sql`.
2. Probar sync con tienda que tenga pedidos, clientes y refunds reales.
3. Validar conteos contra Shopify Admin: productos, variantes, inventario, pedidos, refunds y clientes.
4. Validar webhooks con URL publica o tunel HTTPS.
5. Decidir si pedimos `read_all_orders` para historico mayor a 60 dias o si el MVP acepta ventana limitada.
