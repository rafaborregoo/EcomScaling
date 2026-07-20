# ADR-0011: Uso temporal de Custom distribution para el piloto Shopify

- **Fecha:** 2026-07-17 (formalizado 2026-07-20)
- **Estado:** Aprobada, temporal — condicionada a retirarse cuando Shopify apruebe la app publica.
- **Relacionada:** desvia temporalmente [`ADR-0005-shopify-distribution.md`](ADR-0005-shopify-distribution.md)
  (que sigue siendo la decision de fondo para produccion).

## Contexto

ADR-0005 fijo `Public distribution` como la unica opcion viable para produccion (EcomScaling conecta
tiendas de clientes distintos, no relacionados entre si). Shopify aun no ha aprobado esa app publica.
Mientras tanto, la tienda piloto real (`padelespana.myshopify.com`) necesitaba quedar operativa para poder
avanzar el resto del roadmap (INT-01, DB-05, BE-03) sin bloquear todo detras de la revision de Shopify.

## Decision

Instalar la app en la tienda piloto via `Custom distribution` como puente temporal, en vez de esperar a
que Shopify apruebe la app publica. Consecuencias tecnicas asumidas deliberadamente:

- Dos apps de Shopify conviven: la publica (en revision, `SHOPIFY_API_SECRET`) y la custom
  (`SHOPIFY_CUSTOM_API_SECRET`), cada una con su propio secreto.
- OAuth y verificacion de webhooks prueban ambos secretos (implementado en `shopify-oauth.ts` y, tras el
  fix de esta sesion, en `shopify-webhook-handler.ts`) para que las tiendas instaladas por cualquiera de
  las dos vias sigan funcionando.
- La instalacion via el link de distribucion custom llega sin el `state` que el flujo OAuth propio
  sembraria — se acepta HMAC + coincidencia de shop-domain como alternativa de validacion (fix 2026-07-20).

## Alcance temporal

- **Tiendas permitidas por esta via**: solo la tienda piloto y tiendas de prueba internas — no clientes
  nuevos fuera del piloto controlado.
- **Condicion de retirada**: cuando Shopify apruebe la distribucion publica, migrar la tienda piloto (y
  cualquier otra instalada via custom) a la app publica, y dejar de aceptar instalaciones nuevas por
  custom distribution.
- **Bloqueador de la aprobacion**: faltan los 3 webhooks de privacidad obligatorios
  (`customers/data_request`, `customers/redact`, `shop/redact`) — ver
  `roadmap/roadmaps/04-integraciones/fases/INT-01-shopify.md`. Sin ellos, Shopify no revisara ni aprobara
  la distribucion publica.

## Riesgos de mantener esta desviacion mas tiempo del previsto

- Doble mantenimiento de secretos/flujos mientras conviven ambas apps.
- Cualquier cliente nuevo real (no piloto) instalado por error via custom distribution quedaria fuera del
  modelo aprobado en ADR-0005 y tendria que reinstalarse cuando se migre a la app publica.

## Implementacion

`apps/api/src/shopify-oauth.ts`, `shopify.ts`, `shopify-webhook-handler.ts`, `shopify-token-store.ts`;
commit `bf54847` (cambio a custom distribution) y `f74fcc0` (fix de HMAC dual-secret en webhooks).
