# Fase 17.4 — Execute with Limits — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración de autonomía propia de cada ecommerce para `Execute with Limits`.

## Configuración

- `execution_limits`
- `limit_escalation_rules`
- `authorized_action_types`

## Reglas

- el tenant puede ser más restrictivo que el default global;
- cada cambio debe versionarse;
- límites y permisos deben tener responsable;
- la ausencia de configuración no implica permiso.

## Principio maestro

La autonomía efectiva de una tienda debe ser explícita y auditable.
