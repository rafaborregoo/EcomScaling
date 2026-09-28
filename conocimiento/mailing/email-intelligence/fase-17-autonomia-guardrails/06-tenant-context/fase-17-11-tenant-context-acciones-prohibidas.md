# Fase 17.11 — Acciones prohibidas — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración de autonomía propia de cada ecommerce para `Acciones prohibidas`.

## Configuración

- `tenant_prohibited_actions`
- `restricted_tools`
- `restricted_data_actions`

## Reglas

- el tenant puede ser más restrictivo que el default global;
- cada cambio debe versionarse;
- límites y permisos deben tener responsable;
- la ausencia de configuración no implica permiso.

## Principio maestro

La autonomía efectiva de una tienda debe ser explícita y auditable.
