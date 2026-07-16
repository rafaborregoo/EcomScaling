# DB-09 - Klaviyo y campanas

## Objetivo

Incorporar retencion: listas, segmentos, flows, campanas, formularios, reporting y planificacion de campanas.

## Tablas

- `klaviyo_accounts`
- `klaviyo_lists`
- `klaviyo_list_daily_snapshots`
- `klaviyo_segments`
- `klaviyo_segment_daily_snapshots`
- `klaviyo_flows`
- `klaviyo_flow_actions`
- `klaviyo_flow_messages`
- `klaviyo_campaigns`
- `klaviyo_campaign_messages`
- `klaviyo_campaign_audiences`
- `klaviyo_forms`
- `klaviyo_report_runs`
- `klaviyo_report_values`
- `klaviyo_metrics`
- `klaviyo_daily_account_metrics`
- `marketing_campaigns`
- `marketing_campaign_products`

## Criterios de cierre

- Checks para audiencias por lista o segmento.
- Una sola metrica primaria de conversion por cuenta.
- Reporting idempotente por periodo.
- Campanas planificadas pueden cruzarse con stock.

