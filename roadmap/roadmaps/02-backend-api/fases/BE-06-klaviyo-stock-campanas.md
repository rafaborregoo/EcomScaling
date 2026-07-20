# BE-06 - Klaviyo, stock, campanas y Fathom

## Estado

- **Estado real:** `planned_after_mvp` (no iniciado; correcto no darle mas texto de progreso hasta que
  arranque de verdad).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-09, BE-02
- **Bloqueador:** ninguno tecnico; sin empezar.
- **Evidencia:** ninguna — sin codigo, sin migracion.
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

