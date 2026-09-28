# Fase 13.9 — Offer Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Offer Engine`.

## Parámetros del tenant

- `offer_catalog`
- `discount_policy`
- `margin_floor`
- `stacking_policy`
- `promotion_limits`

---

## Reglas

- estos valores deben estar versionados;
- deben tener source of truth;
- no deben hardcodearse como universales;
- cambios materiales deben poder explicar diferencias entre resultados históricos y actuales.

---

## Principio maestro

El motor es común.

La configuración específica pertenece al tenant.
