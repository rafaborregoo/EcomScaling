# BE-03 - Shopify y metricas MVP

## Estado

> Verificacion vigente 2026-08-24: la reconciliacion de conteos Shopify ya
> devuelve una clasificacion operativa por dataset (`exact`, `warning`,
> `mismatch`) y conserva la razon explicita para diagnostico. Tests directos:
> 4/4 pass. Esto evita tratar como fallo la diferencia historica de pedidos
> documentada para el scope `read_orders`; la alerta persistida sigue fuera de
> este cambio.

- **Estado real:** `in_progress` (funciona con una tienda real, pero el documento mezcla dos sistemas
  complejos — conector y motor financiero — sin el detalle que cada uno necesita para llamarse `done`).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-04, DB-05, DB-03
- **Bloqueador:** ninguno
- **Evidencia:**
  - OAuth Shopify (publica + custom distribution, con fallback de secret) implementado y validado con
    `padelespana.myshopify.com`.
  - Import inicial + incremental parametrizados con el mismo codigo (`runShopifyInitialSync`, modo
    `initial`/`incremental`), reconciliacion periodica via `apps/worker` (cron diario 2am).
  - Motor financiero: funciones SQL `shopify_sales_summary`, `shopify_financial_summary`,
    `shopify_stock_summary` — deterministas, llamadas via `.rpc()`, nunca agregadas en Node (ADR-0006).
  - Fix real 2026-07-20: webhooks rechazados al 100% por HMAC contra el secret equivocado (ver DB-04);
    corregido, probando ambos secrets.
- **Gaps identificados:**
  - Documento recomendado dividir en **BE-03A** (conector), **BE-03B** (worker de sync), **BE-03C**
    (motor financiero), **BE-03D** (API de dashboard) — hoy todo vive en un parrafo que no permite auditar
    cada pieza por separado.
  - Sin version de Shopify API / scopes documentados en este archivo (viven solo en codigo).
  - Sin formula exacta documentada por KPI (inclusion/exclusion de impuestos, refunds, cancelaciones,
    envio, gastos fijos, moneda, periodo, `calculation_version`).
  - "Comparacion manual contra Shopify aceptable" es demasiado ambiguo — falta una desviacion tolerada
    documentada por KPI.
  - Sin freshness/data-quality flags expuestos de forma consistente mas alla del banner de "datos
    incompletos" del dashboard.
- **Siguiente accion:** dividir el documento en BE-03A/B/C/D y, para el motor financiero, escribir la
  formula exacta de cada KPI con su tolerancia de reconciliacion documentada.

## Objetivo

Conectar Shopify y generar los datos necesarios para dashboard y beneficio neto MVP.

## Entregables

- OAuth Shopify sandbox.
- Bulk import de tienda, productos, variantes, inventario y pedidos.
- Webhooks incrementales y reconciliacion periodica.
- Mapeadores a DTOs internos.
- Motor financiero: AOV, pedidos, facturacion, recurrencia, beneficio estimado y freshness.

## Criterios de cierre

- Import inicial y re-sync idempotentes.
- Comparacion manual contra Shopify aceptable.
- Dashboard no depende de mocks permanentes.
