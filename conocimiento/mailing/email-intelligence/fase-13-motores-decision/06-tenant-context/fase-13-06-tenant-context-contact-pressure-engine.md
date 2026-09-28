# Fase 13.6 — Contact Pressure Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Contact Pressure Engine`.

## Parámetros del tenant

- `pressure_weights`
- `pressure_windows`
- `frequency_caps`
- `cooldown_rules`
- `seasonal_overrides`

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
