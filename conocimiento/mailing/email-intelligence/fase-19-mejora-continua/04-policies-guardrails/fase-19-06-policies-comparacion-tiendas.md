# Fase 19.6 — Comparación entre tiendas — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir restricciones duras para `Comparación entre tiendas`.

## Reglas

- No revelar datos identificables o confidenciales de un tenant.
- No permitir reconstrucción razonable de resultados de una tienda concreta.
- Comparaciones cross-tenant requieren agregación y controles de privacidad.

---

## Principio maestro

La mejora continua no puede sacrificar privacidad, aislamiento entre tenants ni trazabilidad.
