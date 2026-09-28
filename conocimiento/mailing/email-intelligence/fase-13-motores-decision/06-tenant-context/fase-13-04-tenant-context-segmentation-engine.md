# Fase 13.4 — Segmentation Engine — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración específica de cada ecommerce utilizada por `Segmentation Engine`.

## Parámetros del tenant

- `segment_definitions`
- `segment_precedence`
- `minimum_segment_size`

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
