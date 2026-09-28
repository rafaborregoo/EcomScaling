# Fase 13.7 — Flow Arbitration Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Flow Arbitration Engine`.

## Parámetros del tenant

- `flow_priority_order`
- `mutex_groups`
- `coexistence_rules`
- `support_priority`

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
