# Fase 17 — Autonomía y Guardrails

## Estado
`COMPLETA`

## Arquitectura aplicada

- `03-runtime`: estados, approval binding, límites, rollback y auditoría.
- `04-policies-guardrails`: restricciones duras y precedencia.
- `06-tenant-context`: configuración específica de autonomía por ecommerce.

## Niveles de autonomía

```text
L0 RECOMMEND_ONLY
L1 DRAFT
L2 APPROVAL_REQUIRED
L3 EXECUTE_WITH_LIMITS
L4 AUTONOMOUS_WITH_GUARDRAILS
```

## Regla central

La autonomía efectiva siempre es el nivel más restrictivo permitido por policy, riesgo, tenant, confidence y tipo de acción.

## Cobertura

- 17.1 Recommend Only
- 17.2 Draft
- 17.3 Approval Required
- 17.4 Execute with Limits
- 17.5 Autonomous with Guardrails
- 17.6 Human-in-the-loop
- 17.7 Límites económicos
- 17.8 Límites de audiencia
- 17.9 Límites de descuentos
- 17.10 Confidence thresholds
- 17.11 Acciones prohibidas
- 17.12 Rollback
- 17.13 Audit Trail
- 17.14 Matriz de autonomía
