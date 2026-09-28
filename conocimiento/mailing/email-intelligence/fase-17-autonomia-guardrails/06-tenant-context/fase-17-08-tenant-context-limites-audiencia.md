# Fase 17.8 — Límites de audiencia — Tenant Context

## Tipo de artefacto
`06-tenant-context`

## Objetivo

Definir la configuración de autonomía propia de cada ecommerce para `Límites de audiencia`.

## Configuración

- `max_audience_size`
- `max_audience_percentage`
- `segment_specific_caps`
- `market_caps`

## Reglas

- el tenant puede ser más restrictivo que el default global;
- cada cambio debe versionarse;
- límites y permisos deben tener responsable;
- la ausencia de configuración no implica permiso.

## Principio maestro

La autonomía efectiva de una tienda debe ser explícita y auditable.
