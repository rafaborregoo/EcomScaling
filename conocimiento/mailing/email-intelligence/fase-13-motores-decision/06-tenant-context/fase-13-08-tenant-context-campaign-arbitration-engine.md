# Fase 13.8 — Campaign Arbitration Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Campaign Arbitration Engine`.

## Parámetros del tenant

- `campaign_priority_rules`
- `blackout_dates`
- `campaign_overlap_rules`
- `campaign_flow_priority_rules`

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
