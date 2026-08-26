# DB-09 - Klaviyo y campanas

> **Estado vigente 2026-08-20:** DB-09 está aplicada y alineada en producción mediante la
> foundation `20260802140000` y sus migraciones de compatibilidad posteriores. Las notas que
> indican que todavía no existe una migración son históricas y quedan supersedidas.

> Corrección de evidencia 2026-08-02: producción es la fuente de verdad para el runtime. Las
> migraciones `20260802150000`, `20260802150100` y `20260802151000` están aplicadas y alinean los
> campos de cuenta, idempotencia y reporting que consume el servicio. La verificación REST confirmó
> que el proyecto real usa el contrato plano de `klaviyo_report_runs`; por eso la API deriva
> `entity_type` de `report_type` al leer, sin solicitar columnas que no existen en producción.

> Corrección vigente 2026-08-02: la foundation y los tres alineamientos runtime están aplicados en
> remoto. El estado de persistencia es `implemented_partial`; quedan validación externa, backfill
> profundo y reporting visual completo.

> La migración `20260802152000_db_09_klaviyo_enum_compatibility.sql` garantiza además que una instalación
> nueva y producción acepten los mismos tipos de reporting sin depender del drift histórico.

> **Correccion de estado 2026-08-02:** `20260802140000_db_09_klaviyo_reporting.sql` esta aplicada
> en remoto. El esquema tenant-scoped cubre cuenta, listas/segmentos, flows, campanas, forms,
> metricas y reporting idempotente, con RLS y checks. DB-09 pasa a `implemented_partial`: el
> contrato de Reporting API y `conversion_metric_id` ya estan cableados; faltan validacion con datos
> reales, backfill/reconciliacion y superficies de reporting en UI.

## Estado

- **Estado real:** `implemented_partial` (migración aplicada; faltan validación con datos reales,
  backfill/reconciliación profunda y superficies de reporting en UI).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** ninguno técnico; quedan validación externa, backfill profundo y reporting visual.
- **Evidencia:** `20260802140000_db_09_klaviyo_reporting.sql`,
  `20260802150000_db_09_klaviyo_account_alignment.sql`, `20260802150100_db_09_klaviyo_idempotency_alignment.sql`,
  `20260802151000_db_09_klaviyo_reporting_alignment.sql`, `20260802152000_db_09_klaviyo_enum_compatibility.sql`
  y `20260802153000_db_09_klaviyo_contract_alignment.sql`, todas presentes y alineadas en remoto.
- **Gaps restantes:** validación con datos Klaviyo reales, backfill/reconciliación profunda y superficies
  visuales completas; no se deben cubrir con filas sintéticas de producción.
- **Siguiente accion:** validar una cuenta real cuando existan credenciales y comparar Reporting API
  con la interfaz de Klaviyo.

## Objetivo

Incorporar retencion: listas, segmentos, flows, campanas, formularios, reporting y planificacion de campanas.

## Preparacion de esquema 2026-08-02

La foundation y los alineamientos de DB-09 ya están aplicados. La ausencia de una cuenta conectada
mantiene el estado `not_available` sin insertar datos sintéticos; cuando llegue OAuth real, el sync
reutilizará estas tablas y el contrato de INT-03.

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
