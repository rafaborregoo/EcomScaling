# DB-06 - Meta Ads

> **Corrección vigente 2026-08-20:** la acción de compra canónica ya está
> definida y materializada por `20260803120000_int_02_canonical_purchase_action_type.sql`.
> Cada cuenta usa un único `canonical_purchase_action_type` (por defecto
> `omni_purchase`, modificable de forma auditable); `attribution_hash`,
> `action_report_time`, ventana, breakdown, nivel y zona horaria forman parte del
> grano de los insights. El esquema y la UI quedan preparados, pero la validación
> con Ads Manager, permisos reales y App Review siguen siendo dependencias externas.

## Estado

- **Estado real:** `blocked_external_validation`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-20
- **Dependencias:** DB-00, DB-04
- **Bloqueador:** App Review y permisos de negocio de Meta (`ads_read`/acceso avanzado) — sin eso no se puede validar con una cuenta publicitaria real.
- **Evidencia:**
  - Migracion `supabase/migrations/20260717170000_db_06_meta_ads.sql` + `db_06a_security_invoker_views` + `db_06b_meta_spend_summary` aplicadas en remoto.
  - Endpoints de conexion/metricas implementados en `apps/api/src/meta.ts` / `meta-metrics.ts` (BE-04), sin poder ejecutarse contra datos reales por el bloqueador de arriba.
- **Gaps identificados:**
  - Validación externa pendiente: App Review, permisos avanzados y una cuenta publicitaria real.
  - Freshness y discrepancias contra Ads Manager no pueden medirse hasta disponer de esa cuenta.
- **Siguiente accion:** ejecutar el checklist externo cuando Meta entregue credenciales y permisos; no crear
  filas de cuentas, insights ni datos simulados en producción antes de ello.

## Objetivo

Normalizar activos publicitarios, insights y metricas calculadas para comparar adquisicion con rentabilidad.

## Preparacion de esquema 2026-08-02

El esquema existente se mantiene preparado para varias cuentas y niveles de Meta,
pero no se crean filas de cuentas, insights o report runs hasta que el proveedor
devuelva datos reales y el activo haya sido seleccionado por la organización. Las
dimensiones de atribución (`level`, fecha, breakdown, ventana, `action_type`, zona
horaria y `action_report_time`) acompañan cada sync. La UI consume el estado común y
`freshness`; no infiere cero a partir de ausencia de filas. Ver el contrato transversal
en [`../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md`](../../04-integraciones/CONTRATO_PREPARACION_CONECTORES.md).

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
