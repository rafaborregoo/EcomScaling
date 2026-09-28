# Fase 17.14 — Matriz de autonomía

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Traducir riesgo, políticas y configuración del tenant al máximo nivel de autonomía permitido.

## Niveles

```text
L0 — RECOMMEND_ONLY
L1 — DRAFT
L2 — APPROVAL_REQUIRED
L3 — EXECUTE_WITH_LIMITS
L4 — AUTONOMOUS_WITH_GUARDRAILS
```

## Resolución conceptual

```text
effective_autonomy =
min(
  configured_agent_level,
  tenant_limit,
  action_risk_limit,
  confidence_limit,
  policy_limit
)
```

La implementación debe resolver reglas explícitas; el LLM no calcula libremente este nivel.

## Ejemplos de downgrade

- stock no fiable → no ejecutar merchandising automático;
- margin UNKNOWN → descuento requiere aprobación o bloqueo;
- audiencia supera cap → approval required;
- confidence baja → recommend only;
- compliance failure → blocked;
- prohibited action → blocked.

## Principio maestro

La autonomía efectiva nunca puede superar el límite más restrictivo aplicable.
