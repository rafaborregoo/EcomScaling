# Fase 13.1 — Lifecycle Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Lifecycle Engine`.

## Parámetros del tenant

- `valid_order_definition`
- `lapse_rules`
- `reactivation_rules`
- `minimum_history`

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
