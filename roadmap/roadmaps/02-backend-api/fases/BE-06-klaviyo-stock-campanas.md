# BE-06 - Klaviyo, stock, campanas y Fathom

> **Correccion de estado 2026-08-02:** el bloque Klaviyo ya tiene OAuth PKCE, almacenamiento
> cifrado, cliente HTTP con revision fija/paginacion segura, sync de metadatos agregados y Reporting
> API idempotente condicionado a una metrica seleccionada. BE-06 pasa a `implemented_partial`;
> backfill/reconciliacion programada, stock/forecast y Fathom siguen siendo subfases pendientes.

> **Correccion 2026-08-02:** la reconciliacion programada de Klaviyo ya esta implementada en
> `apps/api/src/klaviyo-sync.ts`, `apps/worker/src/klaviyo-reconcile-once.ts` y
> `.github/workflows/klaviyo-reconcile.yml`: cada 6 horas, sync incremental y reporting reciente
> solo para conexiones activas con metrica primaria seleccionada. El pendiente restante es el
> backfill historico y la reconciliacion profunda contra una cuenta real.

## Estado

- **Estado real:** `implemented_partial` (Klaviyo OAuth, sync, reporting y reconciliación reciente están
  implementados; stock/forecast, backfill profundo y Fathom siguen pendientes).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-09, BE-02
- **Bloqueador:** ninguno tecnico; sin empezar.
- **Evidencia:** primitives OAuth/PKCE en `apps/api/src/klaviyo-oauth.ts`, sin runner de sync ni
  migración de dominio todavía.
- **Gaps identificados (agrupa 5 sistemas que no comparten dominio tecnico — dividir antes de especificar):**
  - Recomendado dividir en BE-06A (conector Klaviyo), BE-06B (reporting Klaviyo), BE-06C (forecast de
    stock), BE-06D (planificacion de campanas), BE-06E (webhooks Fathom).
  - Klaviyo: sin API revision, OAuth/API key, scopes, refresh, metrica primaria de conversion, timezone,
    moneda, grain de reporting, backfill, rate limits ni reconciliacion definidos.
  - Stock: sin formula, demanda historica, lead time, safety stock, estacionalidad, tratamiento de
    productos sin historico/agotados/con devoluciones, stock por ubicacion ni nivel de confianza.
  - Fathom: sin firma de webhook, idempotency key, asociacion organizacion/llamada, reintentos, manejo de
    transcripcion incompleta ni duplicados definidos.
- **Siguiente accion:** ninguna hasta priorizar este bloque; cuando se priorice, especificar cada
  subdominio por separado antes de escribir la primera migracion.

## Objetivo

Completar retencion y planificacion despues del MVP validado.

## Entregables

- Conector Klaviyo.
- Reporting de flows, campaigns, forms y account metrics.
- Motor de stock y forecast inicial.
- Campanas planificadas con validacion de stock.
- Webhook Fathom para llamadas.

## Criterios de cierre

- Reporting Klaviyo conciliable por periodo.
- Alertas de stock explican supuestos.
- Fathom no duplica llamadas ni resumenes.
