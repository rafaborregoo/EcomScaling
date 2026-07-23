# DB-03 - Configuracion financiera

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion: `supabase/migrations/20260717160000_db_03_configuracion_financiera.sql`, aplicada en remoto.
  - La migracion **real** ya tiene: `organization_id` con FK correcta a `organizations` (no invertida, a diferencia de lo que sugeria el snapshot conceptual retirado), CHECK de porcentajes en escala 0-100 (no 0-1), CHECK de formato de moneda ISO (`^[A-Z]{3}$`), importes no negativos, y `valid_until > valid_from` en gastos fijos y reglas de envio.
- **Invariante documentado 2026-07-21**: `payment_fee_pct`/`vat_pct` (`organization_financial_settings`) usan
  escala **0-100**, no 0-1 -- impuesto por `..._pct_range check (>= 0 and <= 100)` y consumido como `/ 100`
  en las funciones SQL de metricas (`shopify_financial_summary` y afines). Cualquier UI/agente que lea o
  escriba estos campos debe respetar esta escala.
- **Gaps identificados (deliberadamente no tocados en esta ronda -- son decisiones de diseno del motor
  financiero, no verificaciones; cambiarlas sin revisar todos los consumidores podria romper KPIs ya
  calculados):**
  - Sin `calculation_version`/`effective_from`: cambiar un coste hoy puede reescribir silenciosamente el resultado historico de hace meses.
  - Sin proteccion contra solapamiento de `shipping_cost_rules` para la misma zona/periodo.
  - Sin definicion de como se prorratea un gasto fijo (dia/pedido/mes/periodo seleccionado).
  - Sin ejemplos numericos completos ni golden tests del motor financiero.
- **Siguiente accion:** antes de anadir `calculation_version`/`effective_from`, mapear todos los
  consumidores actuales de `organization_financial_settings`/`fixed_expenses`/`shipping_cost_rules` (funciones
  SQL + `apps/api`) para no romper el calculo de KPIs ya en produccion; es un cambio de diseño, no una tarde.

## Objetivo

Guardar los datos manuales necesarios para calcular beneficio neto, break-even y objetivos sin depender de hojas externas.

## Tablas

- `organization_financial_settings`
- `fixed_expenses`
- `shipping_cost_rules`
- `organization_metric_targets`

## Entregables

- Constraints para moneda, porcentajes y vigencia temporal.
- Auditoria de cambios financieros relevantes.
- RLS de lectura/escritura segun rol.

## Criterios de cierre

- El cliente o consultor autorizado puede configurar costes.
- Los cambios sensibles quedan auditados.
- El motor financiero puede leer una configuracion consistente.
