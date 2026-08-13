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
  - ~~Sin definicion de como se prorratea un gasto fijo~~ — **documentado 2026-08-03**, ver abajo: el
    prorrateo si existe en codigo (dias reales del periodo / 30,44), solo faltaba escribirlo.
  - ~~Sin ejemplos numericos completos ni golden tests del motor financiero~~ — **cerrado 2026-08-03**
    (`apps/api/src/db-03-financial-engine-golden.test.ts`, 3/3 contra Supabase real).
- **Siguiente accion:** antes de anadir `calculation_version`/`effective_from`, mapear todos los
  consumidores actuales de `organization_financial_settings`/`fixed_expenses`/`shipping_cost_rules` (funciones
  SQL + `apps/api`) para no romper el calculo de KPIs ya en produccion; es un cambio de diseño, no una tarde.

## Formula real del motor financiero (2026-08-03)

Extraida de `shopify_financial_summary`
(`supabase/migrations/20260717160000_db_03_configuracion_financiera.sql`) y fijada con numeros exactos por
`apps/api/src/db-03-financial-engine-golden.test.ts`. Cualquier cambio aqui debe romper ese test primero.

| Termino                      | Como se calcula hoy                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `net_sales`                  | Suma de `shopify_order_facts.net_sales`, excluyendo test orders y cancelados.                   |
| `cogs`                       | `shopify_margin_summary`: solo lineas con `product_costs` vigente **en la fecha del pedido**.   |
| `gross_margin`               | `net_sales − cogs`.                                                                             |
| `payment_fees`               | `net_sales × payment_fee_pct/100 + orders_count × payment_fee_fixed`.                           |
| `shipping_costs`             | `orders_count × default_shipping_cost`.                                                         |
| `fixed_costs`                | Por gasto: importe mensual (`yearly`/12 si aplica) × dias solapados con el periodo / **30,44**. |
| `net_profit`                 | `gross_margin − payment_fees − shipping_costs − fixed_costs`.                                   |
| `monthly_fixed_costs`        | Gastos vigentes **hoy** (`current_date`), no en el periodo consultado.                          |
| `break_even_monthly_revenue` | `monthly_fixed_costs ÷ ((net_sales − cogs − payment_fees − shipping_costs) / net_sales)`.       |

Caso golden verificado: periodo de 31 dias exactos, 4 pedidos de 250, coste unitario 60, comision 2,5 % +
0,30/pedido, envio 5,00/pedido y un gasto fijo de 304,40/mes → `fixed_costs` 310,00, `net_profit` 403,80,
`net_margin_pct` 40,38 y `break_even_monthly_revenue` 426,45.

### Dos comportamientos que el golden test fija a proposito

1. **`shipping_cost_rules` no se usa en ningun calculo.** La tabla existe, tiene constraints, auditoria,
   endpoints CRUD (`financial-config.ts`) y superficie en `/configuracion`, pero ninguna funcion de
   metricas la lee: el envio siempre sale de `default_shipping_cost × pedidos`. Un cliente puede configurar
   reglas por pais o por importe y **ninguna afecta a su beneficio neto**. Ademas `shopify_order_facts` no
   guarda pais de envio, asi que las reglas con `country_code` no serian evaluables hoy ni queriendo. Es un
   cambio de diseño del motor (no una correccion menor) y queda pendiente de decision explicita, no
   ejecutado por iniciativa propia.
2. **`vat_pct` no entra en el beneficio neto.** `net_sales` de Shopify ya viene sin impuestos, asi que
   restarlo otra vez duplicaria el descuento. El campo se guarda y valida pero hoy no alimenta ningun KPI.

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
