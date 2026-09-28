# Fase 13.10 — Product Recommendation Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Product Recommendation Engine`.

## Parámetros del tenant

- `catalog_source`
- `recommendation_weights`
- `business_priority_weights`
- `compatibility_rules`
- `owned_product_policy`

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
