# ADR-0005 - Distribucion Shopify para EcomScaling IA

## Estado

Aprobada.

## Decision

EcomScaling IA usara una app Shopify con `Public distribution` para conectar tiendas de clientes distintos. `Custom distribution` quedara solo para pruebas internas, dev stores o escenarios limitados a una misma organizacion Shopify Plus.

## Motivo

Shopify documenta que `Custom distribution` esta limitado a una sola tienda, varias tiendas de la misma organizacion Plus o development stores transfer-disabled. Nuestro caso es multi-cliente, por lo que la integracion productiva necesita poder instalarse en tiendas independientes.

## Consecuencias

- La app Shopify productiva se instalara por tienda cliente mediante OAuth.
- El backend guardara una conexion por `organization_id`.
- Las credenciales y tokens permanecen en `private`.
- El frontend solo iniciara el flujo de conexion y mostrara estado.
- La decision de distribucion queda fijada desde el inicio y no se cambia despues.
