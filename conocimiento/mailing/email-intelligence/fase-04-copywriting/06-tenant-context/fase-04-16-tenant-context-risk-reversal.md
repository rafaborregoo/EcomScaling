# Fase 4.16 — Risk Reversal — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la información específica de la tienda necesaria para aplicar correctamente `Risk Reversal`.

## Información del tenant

- `return_policy`
- `warranty_policy`
- `trial_policy`
- `support_policy`
- `shipping_policy`

## Regla

Estos datos deben proceder de fuentes reales de la marca.

Si faltan, la IA debe reconocer la ausencia y evitar inventarlos.
