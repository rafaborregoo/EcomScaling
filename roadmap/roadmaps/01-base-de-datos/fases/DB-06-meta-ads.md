# DB-06 - Meta Ads

## Estado

- **Estado real:** `blocked`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** App Review y permisos de negocio de Meta (`ads_read`/acceso avanzado) — sin eso no se puede validar con una cuenta publicitaria real.
- **Evidencia:**
  - Migracion `supabase/migrations/20260717170000_db_06_meta_ads.sql` + `db_06a_security_invoker_views` + `db_06b_meta_spend_summary` aplicadas en remoto.
  - Endpoints de conexion/metricas implementados en `apps/api/src/meta.ts` / `meta-metrics.ts` (BE-04), sin poder ejecutarse contra datos reales por el bloqueador de arriba.
- **Gaps identificados:**
  - Sin definicion documentada de la accion de compra canonica (`purchase` vs `omni_purchase` vs `offsite_conversion.fb_pixel_purchase`) ni criterio de prioridad entre ellas.
  - Sin ventana de atribucion ni `action_report_time` documentados.
  - Sin unicidad declarada por cuenta/nivel/entidad/fecha/breakdown/ventana de atribucion.
  - Sin zona horaria de la cuenta publicitaria documentada.
  - Sin freshness ni revision de discrepancias contra Ads Manager (no se puede medir sin acceso real).
- **Siguiente accion:** ninguna posible en el schema hasta que Meta apruebe la app; mientras tanto, documentar las decisiones de atribucion/unicidad que no dependen de datos reales.

## Objetivo

Normalizar activos publicitarios, insights y metricas calculadas para comparar adquisicion con rentabilidad.

## Preparacion de esquema 2026-08-02

El esquema existente se mantiene preparado para varias cuentas y niveles de Meta,
pero no se crean filas de cuentas, insights o report runs hasta que el proveedor
devuelva datos reales y el activo haya sido seleccionado por la organización. Las
dimensiones de atribución (`level`, fecha, breakdown, ventana, `action_type`, zona
horaria y `action_report_time`) acompañan cada sync. La UI consume el estado común y
`freshness`; no infiere cero a partir de ausencia de filas. Ver el contrato transversal
en [`../../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).

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
