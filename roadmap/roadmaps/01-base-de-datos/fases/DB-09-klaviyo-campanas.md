# DB-09 - Klaviyo y campanas

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
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** ninguno tecnico; simplemente no se ha empezado (Meta/Shopify tuvieron prioridad).
- **Evidencia:** no existe todavía una migración `db_09_*` en `supabase/migrations/`; la ausencia es
  deliberada hasta cerrar el contrato de persistencia y reporting.
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

## Preparacion de esquema 2026-08-02

No se añade una migración vacía para aparentar que Klaviyo está conectado. Antes de
crear `DB-09`, la migración debe seguir el contrato de OAuth, reporting y selección de
métrica primaria definido en INT-03 y en el contrato transversal. Hasta entonces,
ausencia de tablas y estado `not_available` son deliberados.

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
