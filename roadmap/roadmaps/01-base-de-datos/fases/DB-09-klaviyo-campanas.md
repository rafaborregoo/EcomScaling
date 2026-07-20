# DB-09 - Klaviyo y campanas

## Estado

- **Estado real:** `planned` (no iniciado — sin migracion, sin codigo).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** ninguno tecnico; simplemente no se ha empezado (Meta/Shopify tuvieron prioridad).
- **Evidencia:** ninguna todavia — no existe migracion `db_09_*` en `supabase/migrations/`.
- **Gaps identificados (a resolver antes de escribir la primera migracion, no despues):**
  - Sin `API revision` de Klaviyo declarada.
  - Sin metrica de conversion primaria por cuenta definida (ni su unicidad).
  - Sin timezone/moneda/periodo/grain de reporting decidido.
  - Sin politica de datos personales que NO se van a importar.
  - Sin diferencia definida entre listas/segmentos actuales y snapshots historicos.
  - Sin politica de rate limits/backfill.
- **Siguiente accion:** este documento debe convertirse en un contrato concreto (igual que
  `ESTADOS_Y_EVIDENCIA.md` exige) antes de escribir la primera migracion, no en paralelo.

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

