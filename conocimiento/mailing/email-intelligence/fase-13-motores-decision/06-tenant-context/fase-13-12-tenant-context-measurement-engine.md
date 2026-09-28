# Fase 13.12 — Measurement Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Measurement Engine`.

## Parámetros del tenant

- `metric_definitions`
- `revenue_definition`
- `margin_definition`
- `profit_definition`
- `attribution_model`
- `measurement_windows`

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
