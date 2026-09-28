# Fase 13.13 — Evidence Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Evidence Engine`.

## Parámetros del tenant

- `evidence_quality_rules`
- `learning_promotion_thresholds`

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
