# DB-06 - Meta Ads

## Objetivo

Normalizar activos publicitarios, insights y metricas calculadas para comparar adquisicion con rentabilidad.

## Tablas

- `meta_business_accounts`
- `meta_pages`
- `private.meta_asset_tokens`
- `meta_ad_accounts`
- `meta_campaigns`
- `meta_ad_sets`
- `meta_creatives`
- `meta_creative_assets`
- `meta_ads`
- `meta_ad_creative_assignments`
- `meta_insight_rows_daily`
- `meta_insight_action_metrics`
- `meta_calculated_metrics_daily`
- `meta_insight_report_runs`

## Criterios de cierre

- Insights diarios por nivel autorizado.
- Checks coherentes segun `level`.
- Rate limits y report runs auditables.
- ROAS e inversion pueden compararse contra break-even.

