# DB-03 - Configuracion financiera

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

