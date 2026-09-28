# Fase 17.10 — Confidence Thresholds — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración de autonomía propia de cada ecommerce para `Confidence Thresholds`.

## Configuración

- `confidence_thresholds`
- `autonomy_by_confidence`
- `critical_missing_fields`

## Reglas

- el tenant puede ser más restrictivo que el default global;
- cada cambio debe versionarse;
- límites y permisos deben tener responsable;
- la ausencia de configuración no implica permiso.

## Principio maestro

La autonomía efectiva de una tienda debe ser explícita y auditable.
