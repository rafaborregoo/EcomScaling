# Fase 17.13 — Audit Trail — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración de autonomía propia de cada ecommerce para `Audit Trail`.

## Configuración

- `audit_retention`
- `audit_access_roles`
- `sensitive_field_redaction`
- `export_policy`

## Reglas

- el tenant puede ser más restrictivo que el default global;
- cada cambio debe versionarse;
- límites y permisos deben tener responsable;
- la ausencia de configuración no implica permiso.

## Principio maestro

La autonomía efectiva de una tienda debe ser explícita y auditable.
