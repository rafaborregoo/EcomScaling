# INT-00 - Nucleo comun de integraciones

## Objetivo

Definir patrones comunes para todos los conectores.

## Checklist

- OAuth state/PKCE.
- Scopes minimos.
- Credenciales cifradas.
- DTOs internos versionados.
- Sync inicial, incremental y reconciliacion. Estado: modelo de `integration_sync_runs` definido.
- Rate limits, retries, backoff y dead-letter.
- Webhooks con firma, deduplicacion y replay seguro. Estado: modelo `private.webhook_events` definido.

## Avance 2026-07-15

- Endpoint `GET /v1/organizations/:organizationId/integrations` creado.
- Pantalla `/integraciones` consume estado real y muestra si DB-04 aun no esta aplicada.
- Proveedores iniciales definidos: Shopify, Meta Ads, Klaviyo.
- Ningun token ni payload externo se expone al frontend.

## Criterios de cierre

- Cada proveedor puede implementarse como adaptador. Estado: base comun creada; falta interfaz de adaptadores.
- Ningun payload externo llega crudo al frontend. Estado: cubierto en endpoint de estado.
