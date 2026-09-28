# Fase 13.5 — Eligibility Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Eligibility Engine`.

## Parámetros del tenant

- `eligibility_rules`
- `default_exclusions`
- `market_rules`
- `action_specific_rules`

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
