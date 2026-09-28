# Fase 17.5 — Autonomous with Guardrails — Policies / Guardrails

## Tipo de artefacto
`04-policies-guardrails`

## Objetivo

Definir las restricciones duras que gobiernan `Autonomous with Guardrails`.

## Reglas

- Solo acciones explícitamente autorizadas pueden ser autónomas.
- Cualquier hard policy failure bloquea ejecución.
- Confidence baja o datos críticos incompletos deben reducir autonomía.
- La autonomía puede revocarse inmediatamente.

## Precedencia

```text
PROHIBITED ACTION
>
LEGAL / COMPLIANCE POLICY
>
HARD TENANT LIMIT
>
AUTONOMY LEVEL
>
CONFIDENCE
>
MODEL RECOMMENDATION
```

## Regla de fallo seguro

Ante conflicto crítico o ausencia de información necesaria:

```text
EXECUTE → NO
ESCALATE / BLOCK → YES
```

## Principio maestro

Un guardrail debe impedir ejecución, no limitarse a advertir al agente.
